import { createClient } from "@supabase/supabase-js";

/**
 * Logs a single Azure OpenAI API call to the `azure_token_usage` table.
 * 
 * Resolution priority for user_id + email:
 *   1. Passed directly (user_id + email)
 *   2. email known → look up user_id from profiles table by email
 *   3. user_id known → look up email from auth.users via admin API
 */
export async function logAzureUsage(options) {
  const {
    lead_id = null,
    user_id: rawUserId = null,
    email: rawEmail = null,
    task_type,
    source = 'Azure OpenAI',
    model,
    deployment_name = null,
    azure_request_id = null,
    usage = null,
    response_time_ms = null,
    is_success = true,
    error_message = null
  } = options;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // --- Env var check ---
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ logAzureUsage: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let user_id = rawUserId;
  let email = rawEmail;

  // --- Resolve missing user_id or email ---
  // Case A: We have email but no user_id → look up user_id from profiles table by email
  if (email && !user_id) {
    try {
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (profile?.id) {
        user_id = profile.id;
        console.log(`✅ Resolved user_id from profiles by email: ${user_id}`);
      } else {
        // Also try auth.users directly via admin listUsers (more expensive but thorough)
        console.warn(`⚠️  No profile found for email: ${email}. Trying auth admin lookup...`);
        const { data: adminList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const found = adminList?.users?.find(u => u.email === email);
        if (found) {
          user_id = found.id;
          console.log(`✅ Resolved user_id from auth.users by email: ${user_id}`);
        }
      }
    } catch (lookupErr) {
      console.warn(`⚠️  Could not resolve user_id from email: ${lookupErr?.message}`);
    }
  }

  // Case B: We have user_id but no email → look up email via admin API
  if (user_id && !email) {
    try {
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(user_id);
      if (authUser?.email) {
        email = authUser.email;
        console.log(`✅ Resolved email from auth.users by user_id: ${email}`);
      }
    } catch (adminErr) {
      console.warn(`⚠️  Could not resolve email from user_id: ${adminErr?.message}`);
    }
  }

  // --- Final guard ---
  if (!user_id || !email) {
    console.warn("⚠️  logAzureUsage: Could not resolve user_id or email. Skipping insert.", {
      raw_user_id: rawUserId,
      raw_email: rawEmail,
      resolved_user_id: user_id,
      resolved_email: email,
      task_type
    });
    return;
  }

  // --- Parse token counts ---
  let total_input_tokens = 0;
  let total_output_tokens = 0;
  let total_completion_tokens = 0;
  let api_input_tokens_list = [];
  let api_output_tokens_list = [];
  let api_completion_tokens_arr = [];

  if (usage) {
    total_input_tokens      = usage.prompt_tokens      || 0;
    total_output_tokens     = usage.completion_tokens  || 0;
    total_completion_tokens = usage.total_tokens       || 0;

    api_input_tokens_list     = usage.prompt_tokens_details     ? [usage.prompt_tokens_details]     : [total_input_tokens];
    api_output_tokens_list    = usage.completion_tokens_details ? [usage.completion_tokens_details] : [total_output_tokens];
    api_completion_tokens_arr = [total_completion_tokens];
  }

  // --- Insert ---
  try {
    console.log(`📝 Inserting azure_token_usage: user_id=${user_id}, email=${email}, task_type=${task_type}`);

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
    });

    if (error) {
      console.error(`❌ Failed to log Azure token usage [${task_type}]:`, JSON.stringify(error));
    } else {
      console.log(`📊 Azure token usage logged ✅ [${task_type}]: input=${total_input_tokens}, output=${total_output_tokens}, total=${total_completion_tokens}, success=${is_success}`);
    }
  } catch (err) {
    console.error("❌ logAzureUsage unexpected error:", err?.message || err);
  }
}
