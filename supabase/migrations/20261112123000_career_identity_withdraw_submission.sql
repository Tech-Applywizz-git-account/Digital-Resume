BEGIN;

ALTER TABLE public.career_identity_submissions
    DROP CONSTRAINT career_identity_submissions_workflow_status_check,
    ADD CONSTRAINT career_identity_submissions_workflow_status_check
        CHECK (workflow_status IN (
            'submitted', 'in_progress', 'ready_for_review', 'changes_requested',
            'published', 'superseded', 'withdrawn'
        ));

CREATE OR REPLACE FUNCTION public.ci_withdraw_submission(p_user uuid, p_submission uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    project public.career_identity_projects;
BEGIN
    SELECT * INTO project
    FROM public.career_identity_projects
    WHERE user_id = p_user
    FOR UPDATE;

    IF NOT FOUND OR p_submission IS NULL THEN
        RAISE EXCEPTION 'This submission is no longer pending. Refresh the dashboard.'
            USING ERRCODE = '40001';
    END IF;

    -- A retry after a successful withdrawal must never remove a newer submission.
    IF EXISTS (
        SELECT 1 FROM public.career_identity_submissions
        WHERE id = p_submission AND project_id = project.id AND workflow_status = 'withdrawn'
    ) THEN
        RETURN;
    END IF;

    IF project.pending_submission_id IS DISTINCT FROM p_submission
        OR project.published_submission_id = p_submission THEN
        RAISE EXCEPTION 'This submission is no longer pending. Refresh the dashboard.'
            USING ERRCODE = '40001';
    END IF;

    UPDATE public.career_identity_submissions
    SET workflow_status = 'withdrawn', updated_at = now()
    WHERE id = p_submission AND project_id = project.id
      AND workflow_status IN ('submitted', 'in_progress', 'ready_for_review', 'changes_requested');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'This submission is no longer pending. Refresh the dashboard.'
            USING ERRCODE = '40001';
    END IF;

    UPDATE public.career_identity_projects
    SET pending_submission_id = NULL, updated_at = now()
    WHERE id = project.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ci_withdraw_submission(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ci_withdraw_submission(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
