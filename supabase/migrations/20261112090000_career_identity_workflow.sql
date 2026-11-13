BEGIN;

-- The two tables may already exist if the initial schema was applied in pgAdmin.
CREATE TABLE IF NOT EXISTS public.career_identity_projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
    pending_submission_id uuid,
    published_submission_id uuid,
    clarity_settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(clarity_settings) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ci_projects_distinct_submissions_check
        CHECK (pending_submission_id IS NULL OR published_submission_id IS NULL OR pending_submission_id <> published_submission_id)
);

CREATE TABLE IF NOT EXISTS public.career_identity_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.career_identity_projects (id) ON DELETE CASCADE,
    version_number integer NOT NULL CHECK (version_number > 0),
    idempotency_key uuid NOT NULL,
    source_type text NOT NULL CHECK (source_type IN ('crm_job_requests', 'job_requests')),
    source_cast_id uuid NOT NULL,
    resume_asset_ref text NOT NULL CHECK (btrim(resume_asset_ref) <> ''),
    recording_source text NOT NULL CHECK (recording_source IN ('crm_recordings', 'recordings')),
    recording_id uuid NOT NULL,
    video_asset_ref text NOT NULL CHECK (btrim(video_asset_ref) <> ''),
    theme_id text NOT NULL CHECK (theme_id IN ('aurora', 'zenith', 'atlas')),
    content jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(content) = 'object'),
    workflow_status text NOT NULL DEFAULT 'submitted'
        CHECK (workflow_status IN ('submitted', 'in_progress', 'ready_for_review', 'changes_requested', 'published', 'superseded')),
    submitted_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    published_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    CONSTRAINT ci_submissions_project_id_id_key UNIQUE (project_id, id),
    CONSTRAINT ci_submissions_project_version_key UNIQUE (project_id, version_number),
    CONSTRAINT ci_submissions_project_idempotency_key UNIQUE (project_id, idempotency_key),
    CONSTRAINT ci_submissions_publish_timestamp_check CHECK ((workflow_status = 'published') = (published_at IS NOT NULL))
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.career_identity_projects'::regclass
        AND conname = 'ci_projects_pending_submission_fkey') THEN
        ALTER TABLE public.career_identity_projects ADD CONSTRAINT ci_projects_pending_submission_fkey
            FOREIGN KEY (id, pending_submission_id) REFERENCES public.career_identity_submissions (project_id, id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.career_identity_projects'::regclass
        AND conname = 'ci_projects_published_submission_fkey') THEN
        ALTER TABLE public.career_identity_projects ADD CONSTRAINT ci_projects_published_submission_fkey
            FOREIGN KEY (id, published_submission_id) REFERENCES public.career_identity_submissions (project_id, id);
    END IF;
END;
$$;

ALTER TABLE public.career_identity_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_identity_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.career_identity_projects, public.career_identity_submissions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.career_identity_projects, public.career_identity_submissions TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('career-identity-submissions', 'career-identity-submissions', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ci_submit(p_user uuid, p_expected uuid, p_data jsonb)
RETURNS public.career_identity_submissions
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    project career_identity_projects;
    submission career_identity_submissions;
BEGIN
    INSERT INTO career_identity_projects (user_id, clarity_settings)
    VALUES (p_user, coalesce(p_data->'clarity_settings', '{}'))
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO project FROM career_identity_projects WHERE user_id = p_user FOR UPDATE;
    SELECT * INTO submission FROM career_identity_submissions
        WHERE project_id = project.id AND idempotency_key = (p_data->>'idempotency_key')::uuid;
    IF FOUND THEN
        IF submission.source_type <> p_data->>'source_type'
            OR submission.source_cast_id <> (p_data->>'source_cast_id')::uuid
            OR submission.recording_id <> (p_data->>'recording_id')::uuid THEN
            RAISE EXCEPTION 'This confirmation was already used for another selection.' USING ERRCODE = '40001';
        END IF;
        RETURN submission;
    END IF;

    IF project.pending_submission_id IS DISTINCT FROM p_expected THEN
        RAISE EXCEPTION 'The pending submission changed. Refresh and try again.' USING ERRCODE = '40001';
    END IF;

    UPDATE career_identity_submissions SET workflow_status = 'superseded', updated_at = now()
        WHERE id = project.pending_submission_id;

    INSERT INTO career_identity_submissions (
        project_id, version_number, idempotency_key, source_type, source_cast_id,
        resume_asset_ref, recording_source, recording_id, video_asset_ref, theme_id, content
    ) VALUES (
        project.id, (SELECT coalesce(max(version_number), 0) + 1 FROM career_identity_submissions WHERE project_id = project.id),
        (p_data->>'idempotency_key')::uuid, p_data->>'source_type', (p_data->>'source_cast_id')::uuid,
        p_data->>'resume_asset_ref', p_data->>'recording_source', (p_data->>'recording_id')::uuid,
        p_data->>'video_asset_ref', p_data->>'theme_id', p_data->'content'
    ) RETURNING * INTO submission;

    UPDATE career_identity_projects SET pending_submission_id = submission.id, updated_at = now()
        WHERE id = project.id;
    RETURN submission;
END;
$$;

CREATE OR REPLACE FUNCTION public.ci_admin_save(p_user uuid, p_submission uuid, p_admin uuid, p_data jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    project career_identity_projects;
    should_publish boolean := coalesce(p_data->>'status' = 'published', false);
    edits_submission boolean := p_data ?| ARRAY['content', 'themeId', 'workflowStatus', 'status'];
    updates_wallet boolean := p_data ? 'walletPassUrl';
BEGIN
    SELECT * INTO project FROM career_identity_projects WHERE user_id = p_user FOR UPDATE;
    IF NOT FOUND OR
        p_submission IS DISTINCT FROM coalesce(project.pending_submission_id, project.published_submission_id) OR
        (edits_submission AND (p_submission IS NULL OR p_submission IS DISTINCT FROM project.pending_submission_id)) OR
        (updates_wallet AND p_submission IS NULL) THEN
        RAISE EXCEPTION 'The editable submission changed. Reopen the request.' USING ERRCODE = '40001';
    END IF;

    IF should_publish AND NOT EXISTS (
        SELECT 1 FROM career_identity_submissions WHERE id = p_submission AND workflow_status = 'ready_for_review'
    ) THEN
        RAISE EXCEPTION 'Mark this submission ready for review before publishing.' USING ERRCODE = '40001';
    END IF;
    IF p_data->>'workflowStatus' IN ('published', 'superseded') THEN
        RAISE EXCEPTION 'Use the dedicated workflow action.' USING ERRCODE = '40001';
    END IF;

    IF edits_submission OR updates_wallet THEN
        UPDATE career_identity_submissions SET
            content = content || coalesce(p_data->'content', '{}') ||
                CASE WHEN p_data ? 'walletPassUrl' THEN jsonb_build_object('walletPassUrl', p_data->'walletPassUrl') ELSE '{}' END,
            theme_id = coalesce(p_data->>'themeId', theme_id),
            workflow_status = CASE WHEN should_publish THEN 'published'
                ELSE coalesce(p_data->>'workflowStatus', workflow_status) END,
            published_at = CASE WHEN should_publish THEN now() ELSE published_at END,
            published_by = CASE WHEN should_publish THEN p_admin ELSE published_by END,
            updated_at = now()
        WHERE id = p_submission;
    END IF;

    UPDATE career_identity_projects SET
        clarity_settings = CASE WHEN p_data ? 'clarity' THEN
            (clarity_settings || ((p_data->'clarity') - 'clientConsent'::text)) ||
            CASE WHEN p_data->'clarity'->'clientConsent'->>'accepted' = 'false'
                THEN jsonb_build_object('clientConsent', p_data->'clarity'->'clientConsent', 'status', 'disabled')
                ELSE '{}'::jsonb END ||
            CASE WHEN coalesce((clarity_settings->'clientConsent'->>'accepted')::boolean, false)
                THEN '{}'::jsonb ELSE '{"status":"disabled"}'::jsonb END
        ELSE clarity_settings END,
        published_submission_id = CASE WHEN should_publish THEN p_submission ELSE published_submission_id END,
        pending_submission_id = CASE WHEN should_publish THEN NULL ELSE pending_submission_id END,
        updated_at = now()
    WHERE id = project.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ci_submit(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ci_admin_save(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ci_submit(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_admin_save(uuid, uuid, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.ci_update_consent(p_user uuid, p_accepted boolean)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    settings jsonb;
    consent jsonb;
BEGIN
    INSERT INTO career_identity_projects (user_id, clarity_settings)
    VALUES (p_user, coalesce((SELECT (career_identity_data->'clarity')::jsonb FROM profiles WHERE id = p_user), '{}'))
    ON CONFLICT (user_id) DO NOTHING;

    SELECT clarity_settings INTO settings FROM career_identity_projects WHERE user_id = p_user FOR UPDATE;
    consent := coalesce(settings->'clientConsent', '{}');
    settings := settings || jsonb_build_object(
        'clientConsent', consent || jsonb_build_object(
            'accepted', p_accepted,
            'acceptedAt', CASE WHEN p_accepted THEN to_jsonb(now()) ELSE consent->'acceptedAt' END,
            'revokedAt', CASE WHEN p_accepted THEN NULL ELSE to_jsonb(now()) END
        ),
        'status', CASE WHEN NOT p_accepted THEN 'disabled'
            WHEN settings->>'status' = 'active' THEN 'active' ELSE 'pending' END
    );

    UPDATE career_identity_projects SET clarity_settings = settings, updated_at = now() WHERE user_id = p_user;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ci_update_consent(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ci_update_consent(uuid, boolean) TO service_role;

COMMIT;
