BEGIN;

CREATE OR REPLACE FUNCTION public.ci_apply_avatar(p_content jsonb, p_avatar text)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT jsonb_set(p_content, '{hero}', (CASE
        WHEN jsonb_typeof(p_content->'hero') = 'object' THEN p_content->'hero'
        ELSE '{}'::jsonb END - 'profileImageUrl'::text)
        || CASE WHEN p_avatar IS NULL THEN '{}'::jsonb
           ELSE jsonb_build_object('profileImageUrl', p_avatar) END);
$$;

CREATE OR REPLACE FUNCTION public.ci_update_appearance(
    p_user uuid, p_submission uuid, p_theme text, p_avatar text, p_change_avatar boolean
)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    project public.career_identity_projects;
BEGIN
    SELECT * INTO project FROM public.career_identity_projects WHERE user_id = p_user FOR UPDATE;
    IF NOT FOUND OR p_submission IS NULL OR project.published_submission_id IS DISTINCT FROM p_submission THEN
        RAISE EXCEPTION 'The published profile changed. Refresh the dashboard and try again.'
            USING ERRCODE = '40001';
    END IF;

    UPDATE public.career_identity_submissions
    SET theme_id = p_theme,
        content = CASE WHEN p_change_avatar THEN public.ci_apply_avatar(content, p_avatar) ELSE content END,
        updated_at = now()
    WHERE id = p_submission AND project_id = project.id AND workflow_status = 'published';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'The published profile changed. Refresh the dashboard and try again.'
            USING ERRCODE = '40001';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ci_submit(p_user uuid, p_expected uuid, p_data jsonb)
RETURNS public.career_identity_submissions
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    project career_identity_projects;
    submission career_identity_submissions;
    live career_identity_submissions;
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

    SELECT * INTO live FROM career_identity_submissions WHERE id = project.published_submission_id;

    UPDATE career_identity_submissions SET workflow_status = 'superseded', updated_at = now()
        WHERE id = project.pending_submission_id;

    INSERT INTO career_identity_submissions (
        project_id, version_number, idempotency_key, source_type, source_cast_id,
        resume_asset_ref, recording_source, recording_id, video_asset_ref, theme_id, content
    ) VALUES (
        project.id, (SELECT coalesce(max(version_number), 0) + 1 FROM career_identity_submissions WHERE project_id = project.id),
        (p_data->>'idempotency_key')::uuid, p_data->>'source_type', (p_data->>'source_cast_id')::uuid,
        p_data->>'resume_asset_ref', p_data->>'recording_source', (p_data->>'recording_id')::uuid,
        p_data->>'video_asset_ref', coalesce(live.theme_id, p_data->>'theme_id'),
        CASE WHEN live.id IS NULL THEN p_data->'content'
             ELSE public.ci_apply_avatar(p_data->'content', live.content #>> '{hero,profileImageUrl}') END
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
    live career_identity_submissions;
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

    SELECT * INTO live FROM career_identity_submissions WHERE id = project.published_submission_id;

    IF edits_submission OR updates_wallet THEN
        UPDATE career_identity_submissions SET
            content = (CASE WHEN live.id IS NULL THEN content || coalesce(p_data->'content', '{}')
                ELSE public.ci_apply_avatar(content || coalesce(p_data->'content', '{}'),
                    live.content #>> '{hero,profileImageUrl}') END) ||
                CASE WHEN p_data ? 'walletPassUrl' THEN jsonb_build_object('walletPassUrl', p_data->'walletPassUrl') ELSE '{}' END,
            theme_id = coalesce(live.theme_id, p_data->>'themeId', theme_id),
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

REVOKE EXECUTE ON FUNCTION public.ci_apply_avatar(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ci_update_appearance(uuid, uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ci_apply_avatar(jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ci_update_appearance(uuid, uuid, text, text, boolean) TO service_role;
NOTIFY pgrst, 'reload schema';

COMMIT;
