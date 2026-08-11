import { createClient } from "@supabase/supabase-js";

/**
 * Logs a single Azure OpenAI API call to the `azure_token_usage` table.
 *
 * @param {Object} options
 * @param {number|null}  options.lead_id          - Lead ID (integer), nullable
 * @param {string}       options.user_id           - UUID of the portfolio owner (NOT NULL in schema)
 * @param {string}       options.email             - Email of the user (NOT NULL in schema)
 * @param {string}       options.task_type         - 'generate_introduction' | 'resume_chat'
 * @param {string}       [options.source]          - Source label, defaults to 'Azure OpenAI'
 * @param {string}       options.model             - Model name returned by Azure
 * @param {string|null}  [options.deployment_name] - Azure deployment name
 * @param {string|null}  [options.azure_request_id]- Azure response ID
 * @param {Object|null}  [options.usage]           - Azure usage object (prompt_tokens, completion_tokens, total_tokens, etc.)
 * @param {number|null}  [options.response_time_ms]- Total response time in milliseconds
 * @param {boolean}      options.is_success        - Whether the API call succeeded
 * @param {string|null}  [options.error_message]   - Error message on failure
 */
export async function logAzureUsage(options) {
  const {
    lead_id = null,
    user_id,
    email,
    task_type,
    source = 'Azure OpenAI',  // matches table column default
    model,
    deployment_name = null,
    azure_request_id = null,
    usage = null,             // Azure usage object from completionResponse.usage
    response_time_ms = null,
    is_success = true,
    error_message = null
  } = options;

  // Guard: user_id and email are NOT NULL in the schema
  if (!user_id || !email) {
    console.warn("⚠️  logAzureUsage: user_id and email are required. Skipping log.", { user_id, email, task_type });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ logAzureUsage: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    return;
  }

  // Parse token counts from the Azure usage object
  let total_input_tokens = 0;
  let total_output_tokens = 0;
  let total_completion_tokens = 0;
  let api_input_tokens_list = [];
  let api_output_tokens_list = [];
  let api_completion_tokens_arr = [];

  if (usage) {
    // prompt_tokens  → input tokens sent to the model
    // completion_tokens → output tokens generated
    // total_tokens   → prompt + completion
    total_input_tokens      = usage.prompt_tokens      || 0;
    total_output_tokens     = usage.completion_tokens  || 0;
    total_completion_tokens = usage.total_tokens       || 0;

    // Store granular breakdown details if Azure returns them (e.g. cached_tokens)
    api_input_tokens_list      = usage.prompt_tokens_details     ? [usage.prompt_tokens_details]     : [total_input_tokens];
    api_output_tokens_list     = usage.completion_tokens_details ? [usage.completion_tokens_details] : [total_output_tokens];
    api_completion_tokens_arr  = [total_completion_tokens];
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { error } = await supabaseAdmin.from('azure_token_usage').insert({
      lead_id,
      user_id,
      email,
      task_date: new Date().toISOString().split('T')[0], // 'YYYY-MM-DD'
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
      api_completion_tokens: api_completion_tokens_arr,
      response_time_ms,
      is_success,
      error_message,
      // created_at is set automatically by Postgres default: timezone('utc', now())
    });

    if (error) {
      console.error(`❌ Failed to log Azure token usage [${task_type}]:`, error);
    } else {
      console.log(`📊 Azure token usage logged [${task_type}]: input=${total_input_tokens}, output=${total_output_tokens}, total=${total_completion_tokens}, success=${is_success}`);
    }
  } catch (err) {
    console.error("❌ logAzureUsage unexpected error:", err);
  }
}
