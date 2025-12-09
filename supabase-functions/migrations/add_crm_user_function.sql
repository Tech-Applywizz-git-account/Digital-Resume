-- ========================================
-- Function to Add New CRM User
-- ========================================
-- This function makes it easy to add new CRM users with proper validation

CREATE OR REPLACE FUNCTION add_crm_user(
  p_email text,
  p_credits integer DEFAULT 4,
  p_user_id uuid DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_result json;
  v_existing_count integer;
BEGIN
  -- Validate email format
  IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid email format'
    );
  END IF;

  -- Check if user already exists
  SELECT COUNT(*) INTO v_existing_count
  FROM public.digital_resume_by_crm
  WHERE email = p_email;

  IF v_existing_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User already exists in CRM system',
      'email', p_email
    );
  END IF;

  -- Insert new CRM user
  INSERT INTO public.digital_resume_by_crm (
    email,
    user_id,
    credits_remaining,
    is_active,
    user_created_at,
    last_sync_at
  )
  VALUES (
    p_email,
    p_user_id,
    p_credits,
    true,
    NOW(),
    NOW()
  );

  -- Create initial dashboard stats record
  INSERT INTO public.crm_dashboard_stats (
    email,
    user_id,
    total_applications,
    total_recordings,
    total_resumes,
    total_views,
    created_at,
    updated_at
  )
  VALUES (
    p_email,
    p_user_id,
    0,
    0,
    0,
    0,
    NOW(),
    NOW()
  );

  -- Return success
  RETURN json_build_object(
    'success', true,
    'email', p_email,
    'credits', p_credits,
    'message', 'CRM user added successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_crm_user(text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION add_crm_user(text, integer, uuid) TO service_role;

COMMENT ON FUNCTION add_crm_user(text, integer, uuid) IS 
  'Adds a new user to the CRM system. Parameters: email (required), credits (default 4), user_id (optional)';

-- ========================================
-- Function to Bulk Add CRM Users
-- ========================================

CREATE OR REPLACE FUNCTION bulk_add_crm_users(
  p_emails text[]
)
RETURNS json AS $$
DECLARE
  v_email text;
  v_added_count integer := 0;
  v_failed_count integer := 0;
  v_results json[] := '{}';
  v_result json;
BEGIN
  -- Loop through each email
  FOREACH v_email IN ARRAY p_emails
  LOOP
    -- Try to add each user
    v_result := add_crm_user(v_email, 4, NULL);
    
    -- Count successes and failures
    IF (v_result->>'success')::boolean THEN
      v_added_count := v_added_count + 1;
    ELSE
      v_failed_count := v_failed_count + 1;
    END IF;
    
    -- Add to results array
    v_results := array_append(v_results, v_result);
  END LOOP;

  -- Return summary
  RETURN json_build_object(
    'total_processed', array_length(p_emails, 1),
    'successfully_added', v_added_count,
    'failed', v_failed_count,
    'details', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION bulk_add_crm_users(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_add_crm_users(text[]) TO service_role;

-- ========================================
-- Usage Examples
-- ========================================

-- Example 1: Add a single user with default 4 credits
-- SELECT add_crm_user('newuser@example.com');

-- Example 2: Add a user with custom credits
-- SELECT add_crm_user('newuser@example.com', 10);

-- Example 3: Add a user and link to existing auth account
-- SELECT add_crm_user('newuser@example.com', 4, 'auth-user-id-here');

-- Example 4: Bulk add multiple users
-- SELECT bulk_add_crm_users(ARRAY[
--   'user1@example.com',
--   'user2@example.com',
--   'user3@example.com'
-- ]);

-- Example 5: View all CRM users
-- SELECT email, credits_remaining, is_active, user_created_at 
-- FROM digital_resume_by_crm 
-- ORDER BY user_created_at DESC;
