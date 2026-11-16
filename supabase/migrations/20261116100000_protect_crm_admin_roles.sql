BEGIN;

-- Membership writes go through the authenticated Express admin endpoints.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.crm_admins FROM PUBLIC, anon, authenticated;
DO $$
DECLARE
    columns text;
BEGIN
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO columns FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_admins';
    EXECUTE format('REVOKE INSERT (%1$s), UPDATE (%1$s) ON TABLE public.crm_admins FROM PUBLIC, anon, authenticated', columns);
END;
$$;

GRANT SELECT, INSERT, UPDATE ON TABLE public.crm_admins TO service_role;

CREATE OR REPLACE FUNCTION public.set_crm_admin_role(p_actor text, p_target text, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    changed public.crm_admins;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('public.crm_admins.role_change', 0));
    IF NOT EXISTS (
        SELECT 1 FROM public.crm_admins WHERE lower(trim(email)) = p_actor AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Super Admin access required.' USING ERRCODE = '42501';
    END IF;

    IF p_role IS NULL OR p_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Choose a supported admin role.' USING ERRCODE = '22023';
    END IF;

    IF p_role = 'admin' AND (p_actor = p_target OR (
        SELECT count(*) FROM public.crm_admins WHERE role = 'super_admin'
    ) <= 1) THEN
        RAISE EXCEPTION 'You cannot demote yourself or the last Super Admin.' USING ERRCODE = '40001';
    END IF;

    UPDATE public.crm_admins
    SET role = p_role
    WHERE lower(trim(email)) = p_target AND role <> p_role
    RETURNING * INTO changed;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'This account role changed or no longer exists. Refresh and try again.' USING ERRCODE = '40001';
    END IF;
    RETURN jsonb_build_object('email', changed.email, 'role', changed.role, 'created_at', changed.created_at);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_crm_admin_role(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_crm_admin_role(text, text, text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
