BEGIN;

CREATE OR REPLACE FUNCTION public.ci_update_consent(p_user uuid, p_accepted boolean)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    settings jsonb;
    consent jsonb;
    project_id text;
    resume_project_id text;
BEGIN
    INSERT INTO public.career_identity_projects (user_id, clarity_settings)
    VALUES (p_user, COALESCE((
        SELECT (career_identity_data->'clarity')::jsonb
        FROM public.profiles
        WHERE id = p_user
    ), '{}'::jsonb))
    ON CONFLICT (user_id) DO NOTHING;

    SELECT clarity_settings INTO settings
    FROM public.career_identity_projects
    WHERE user_id = p_user
    FOR UPDATE;

    consent := COALESCE(settings->'clientConsent', '{}'::jsonb);
    project_id := NULLIF(btrim(settings->>'projectId'), '');
    resume_project_id := settings->>'clientPausedProjectId';

    IF NOT p_accepted AND settings->>'status' = 'active'
        AND consent->>'accepted' = 'true' THEN
        resume_project_id := project_id;
    END IF;

    UPDATE public.career_identity_projects
    SET clarity_settings = settings || jsonb_build_object(
        'clientConsent', consent || jsonb_build_object(
            'accepted', p_accepted,
            'acceptedAt', CASE WHEN p_accepted THEN to_jsonb(now()) ELSE consent->'acceptedAt' END,
            'revokedAt', CASE WHEN p_accepted THEN NULL ELSE to_jsonb(now()) END
        ),
        'clientPausedProjectId', CASE WHEN p_accepted THEN NULL ELSE resume_project_id END,
        'status', CASE
            WHEN NOT p_accepted THEN 'disabled'
            WHEN project_id IS NOT NULL AND (
                settings->>'status' = 'active' OR resume_project_id = project_id
            ) THEN 'active'
            ELSE 'pending'
        END
    ),
    updated_at = now()
    WHERE user_id = p_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ci_update_consent(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ci_update_consent(uuid, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
