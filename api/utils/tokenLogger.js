import { createClient } from "@supabase/supabase-js";

export async function logAzureUsage(options) {
  const {
    lead_id = null,
    user_id = null,
    email = null,
    task_type,
    source,
    model,
    deployment_name,
    azure_request_id,
    usage, // Azure usage object
    response_time_ms,
    is_success,
    error_message = null
  } = options;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials for token logging");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let total_input_tokens = 0;
  let total_output_tokens = 0;
  let total_completion_tokens = 0;
  let api_input_tokens_list = null;
  let api_output_tokens_list = null;
  let api_completion_tokens = null;

  if (usage) {
    total_input_tokens = usage.prompt_tokens || 0;
    total_output_tokens = usage.completion_tokens || 0;
    total_completion_tokens = usage.total_tokens || 0;
    
    // Store exact raw values as JSON arrays/objects if needed by schema
    api_input_tokens_list = usage.prompt_tokens_details ? [usage.prompt_tokens_details] : [total_input_tokens];
    api_output_tokens_list = usage.completion_tokens_details ? [usage.completion_tokens_details] : [total_output_tokens];
    api_completion_tokens = [total_completion_tokens];
  }

  try {
    // Insert a single row per Azure request
    const { error } = await supabaseAdmin.from('azure_token_usage').insert({
      lead_id,
      user_id,
      email,
      task_date: new Date().toISOString().split('T')[0], // yyyy-mm-dd
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
      error_message,
      // created_at is handled by default now() in Postgres
    });

    if (error) {
      console.error("❌ Failed to log Azure token usage:", error);
    } else {
      console.log(`📊 Token Usage logged successfully for ${task_type}.`);
    }
  } catch (err) {
    console.error("❌ Usage logging error:", err);
  }
}
