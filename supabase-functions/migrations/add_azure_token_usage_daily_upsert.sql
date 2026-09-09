CREATE UNIQUE INDEX IF NOT EXISTS idx_azure_token_usage_user_task_date
ON public.azure_token_usage (user_id, task_type, task_date);

CREATE TABLE IF NOT EXISTS public.azure_token_usage_requests (
  user_id uuid NOT NULL,
  task_type text NOT NULL,
  task_date date NOT NULL,
  azure_request_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT azure_token_usage_requests_pkey
    PRIMARY KEY (user_id, task_type, task_date, azure_request_id)
);

CREATE OR REPLACE FUNCTION public.upsert_azure_token_usage(
  p_lead_id integer,
  p_user_id uuid,
  p_email text,
  p_task_date date,
  p_task_type text,
  p_source text,
  p_model text,
  p_deployment_name text,
  p_azure_request_id text,
  p_total_input_tokens integer,
  p_total_output_tokens integer,
  p_total_completion_tokens integer,
  p_api_input_tokens_list text,
  p_api_output_tokens_list text,
  p_api_completion_tokens text,
  p_response_time_ms integer,
  p_is_success boolean,
  p_error_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_rows integer;
BEGIN
  IF p_azure_request_id IS NOT NULL THEN
    INSERT INTO public.azure_token_usage_requests (
      user_id,
      task_type,
      task_date,
      azure_request_id
    )
    VALUES (p_user_id, p_task_type, p_task_date, p_azure_request_id)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS request_rows = ROW_COUNT;
    IF request_rows = 0 THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.azure_token_usage (
    lead_id,
    user_id,
    email,
    task_date,
    task_type,
    source,
    model,
    deployment_name,
    azure_request_id,
    total_input_tokens,
    total_output_tokens,
    total_completion_tokens,
    api_input_tokens_list,
    api_output_tokens_list,
    api_completion_tokens,
    response_time_ms,
    is_success,
    error_message
  )
  VALUES (
    p_lead_id,
    p_user_id,
    p_email,
    p_task_date,
    p_task_type,
    p_source,
    p_model,
    p_deployment_name,
    p_azure_request_id,
    COALESCE(p_total_input_tokens, 0),
    COALESCE(p_total_output_tokens, 0),
    COALESCE(p_total_completion_tokens, 0),
    COALESCE(p_api_input_tokens_list, ''),
    COALESCE(p_api_output_tokens_list, ''),
    COALESCE(p_api_completion_tokens, ''),
    p_response_time_ms,
    p_is_success,
    p_error_message
  )
  ON CONFLICT (user_id, task_type, task_date)
  DO UPDATE SET
    api_input_tokens_list = CASE
      WHEN NULLIF(public.azure_token_usage.api_input_tokens_list, '') IS NULL
        THEN EXCLUDED.api_input_tokens_list
      WHEN NULLIF(EXCLUDED.api_input_tokens_list, '') IS NULL
        THEN public.azure_token_usage.api_input_tokens_list
      ELSE public.azure_token_usage.api_input_tokens_list || ',' || EXCLUDED.api_input_tokens_list
    END,
    api_output_tokens_list = CASE
      WHEN NULLIF(public.azure_token_usage.api_output_tokens_list, '') IS NULL
        THEN EXCLUDED.api_output_tokens_list
      WHEN NULLIF(EXCLUDED.api_output_tokens_list, '') IS NULL
        THEN public.azure_token_usage.api_output_tokens_list
      ELSE public.azure_token_usage.api_output_tokens_list || ',' || EXCLUDED.api_output_tokens_list
    END,
    api_completion_tokens = CASE
      WHEN NULLIF(public.azure_token_usage.api_completion_tokens, '') IS NULL
        THEN EXCLUDED.api_completion_tokens
      WHEN NULLIF(EXCLUDED.api_completion_tokens, '') IS NULL
        THEN public.azure_token_usage.api_completion_tokens
      ELSE public.azure_token_usage.api_completion_tokens || ',' || EXCLUDED.api_completion_tokens
    END,
    total_input_tokens = COALESCE(public.azure_token_usage.total_input_tokens, 0)
      + COALESCE(EXCLUDED.total_input_tokens, 0),
    total_output_tokens = COALESCE(public.azure_token_usage.total_output_tokens, 0)
      + COALESCE(EXCLUDED.total_output_tokens, 0),
    total_completion_tokens = COALESCE(public.azure_token_usage.total_completion_tokens, 0)
      + COALESCE(EXCLUDED.total_completion_tokens, 0),
    response_time_ms = COALESCE(public.azure_token_usage.response_time_ms, 0)
      + COALESCE(EXCLUDED.response_time_ms, 0),
    azure_request_id = EXCLUDED.azure_request_id,
    is_success = EXCLUDED.is_success,
    error_message = EXCLUDED.error_message
  ;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_azure_token_usage(
  integer, uuid, text, date, text, text, text, text, text,
  integer, integer, integer, text, text, text, integer, boolean, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_azure_token_usage(
  integer, uuid, text, date, text, text, text, text, text,
  integer, integer, integer, text, text, text, integer, boolean, text
) TO service_role;