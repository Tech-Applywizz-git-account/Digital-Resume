import { createClient } from "@supabase/supabase-js";

<<<<<<< HEAD
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
=======
/**
 * Logs a single Azure OpenAI API call to `public.azure_token_usage`.
 *
 * User resolution strategy (server-side only):
 *   1. Receive `user_id` — the portfolio owner's ID.
 *   2. Query `public.digital_resume_by_crm` by user_id to get the authoritative `email`.
 *   3. If the CRM record is missing or email is NULL → log error, skip logging.
 *      The Azure response is never blocked by logging failures.
 *
 * @param {Object}       options
 * @param {string}       options.user_id           - Portfolio owner's ID (required)
 * @param {string}       options.task_type         - 'generate_introduction' | 'resume_chat' | 'rerecording'
 * @param {string}       options.model             - Model name from Azure response
 * @param {string|null}  [options.deployment_name] - Azure deployment name
 * @param {string|null}  [options.azure_request_id]- Azure response .id field
 * @param {Object|null}  [options.usage]           - completionResponse.usage from Azure SDK
 * @param {number|null}  [options.response_time_ms]- Wall-clock ms for the Azure call
 * @param {boolean}      [options.is_success]      - Whether the Azure call succeeded
 * @param {string|null}  [options.error_message]   - Error message on failure
 * @param {number|null}  [options.lead_id]         - Optional integer lead ID
 */
export async function logAzureUsage(options) {
  const {
    user_id: rawUserId,
    task_type,
    model,
    deployment_name  = null,
    azure_request_id = null,
    usage            = null,
    response_time_ms = null,
    is_success       = true,
    error_message    = null,
    lead_id          = null,
  } = options;

  // ── 1. Validate inputs ──────────────────────────────────────────────────────
  const user_id = rawUserId || null;

  console.log("========== AZURE TOKEN LOGGER START ==========");
  console.log("Task Type:", task_type);
  console.log("User ID:", user_id);
  console.log("Lead ID:", lead_id);

  console.log(
    "SUPABASE_URL configured:",
    !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)
  );

  console.log(
    "SUPABASE_SERVICE_ROLE_KEY configured:",
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log("==============================================");

  if (!user_id) {
    console.error("❌ logAzureUsage: `user_id` is required.", { task_type });
    return;
  }

  const supabaseUrl      = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ logAzureUsage: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
>>>>>>> feef1e883ec1c68c2bb1718de9d1ca284e5f8455
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

<<<<<<< HEAD
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
=======
  // ── 2. Resolve email from digital_resume_by_crm ──────────────────────────
  let email = null;

  try {
    const { data: crmRecord, error: crmErr } = await supabaseAdmin
      .from('digital_resume_by_crm')
      .select('email, user_id')
      .eq('user_id', user_id)
      .maybeSingle();

    console.log("========== CRM LOOKUP ==========");
    console.log("Lookup by user_id:", user_id);
    console.log("CRM record found:", !!crmRecord);
    console.log("CRM email:", crmRecord?.email || null);
    console.log("CRM user_id:", crmRecord?.user_id || null);

    if (crmErr) {
      console.error("CRM error:", {
        code: crmErr.code,
        message: crmErr.message,
        details: crmErr.details,
        hint: crmErr.hint,
      });
    }

    console.log("================================");

    if (crmErr) {
      console.error("❌ logAzureUsage: CRM lookup failed.", {
        code:    crmErr.code,
        message: crmErr.message,
        details: crmErr.details,
        hint:    crmErr.hint,
        user_id,
        task_type,
      });
      return;
    }

    if (!crmRecord) {
      console.error(
        `❌ logAzureUsage: No digital_resume_by_crm record found for user_id="${user_id}". ` +
        `Token usage for task_type="${task_type}" will NOT be saved.`
      );
      return;
    }

    if (!crmRecord.email) {
      console.error(
        `❌ logAzureUsage: digital_resume_by_crm.email is NULL for user_id="${user_id}". ` +
        `Token usage for task_type="${task_type}" will NOT be saved.`
      );
      return;
    }

    email = crmRecord.email.trim().toLowerCase();

  } catch (lookupErr) {
    console.error("❌ logAzureUsage: Unexpected error during CRM lookup.", lookupErr?.message);
    return;
  }

  // ── 3. Map Azure token counts ───────────────────────────────────────────────
  // Exact values from completionResponse.usage — never estimated or hardcoded.
  const usages = Array.isArray(usage) ? usage : (usage ? [usage] : []);

  let total_input_tokens = 0;
  let total_output_tokens = 0;
  let total_completion_tokens = 0;

  const input_tokens_list = [];
  const output_tokens_list = [];
  const completion_tokens_list = [];

  const numericTokenCount = (value) => {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  };

  for (const u of usages) {
    const pTokens = numericTokenCount(u?.prompt_tokens);
    const cTokens = numericTokenCount(u?.completion_tokens);
    const tTokens = numericTokenCount(u?.total_tokens);

    total_input_tokens += pTokens;
    total_output_tokens += cTokens;
    total_completion_tokens += tTokens;

    input_tokens_list.push(pTokens);
    output_tokens_list.push(cTokens);
    completion_tokens_list.push(tTokens);

    const rTokens = u?.completion_tokens_details?.reasoning_tokens;
    if (rTokens !== undefined) {
      console.log("Azure OpenAI reasoning_tokens:", rTokens);
    }
  }

  const api_input_tokens_list = input_tokens_list.join(',');
  const api_output_tokens_list = output_tokens_list.join(',');
  const api_completion_tokens = completion_tokens_list.join(',');

  // ── 4. Atomically aggregate into azure_token_usage ─────────────────────────
  console.log("========== TOKEN INSERT DATA ==========");
  console.log("TOKEN DATA BEFORE SUPABASE INSERT:", {
    inputTokensList: api_input_tokens_list,
    outputTokensList: api_output_tokens_list,
    completionTokensList: api_completion_tokens,
    totalInputTokens: total_input_tokens,
    totalOutputTokens: total_output_tokens,
    totalCompletionTokens: total_completion_tokens
  });
  console.log("user_id:", user_id);
  console.log("email:", email);
  console.log("lead_id:", null);
  console.log("task_type:", task_type);
  console.log("input tokens:", total_input_tokens);
  console.log("output tokens:", total_output_tokens);
  console.log("total tokens:", total_completion_tokens);
  console.log("=======================================");

  const task_date = new Date().toISOString().split('T')[0];

  try {
    const { error: insertErr } = await supabaseAdmin.rpc('upsert_azure_token_usage', {
      p_lead_id: null,
      p_user_id: user_id,
      p_email: email,
      p_task_date: task_date,
      p_task_type: task_type,
      p_source: 'Azure OpenAI',
      p_model: model,
      p_deployment_name: deployment_name,
      p_azure_request_id: azure_request_id,
      p_total_input_tokens: total_input_tokens,
      p_total_output_tokens: total_output_tokens,
      p_total_completion_tokens: total_completion_tokens,
      p_api_input_tokens_list: api_input_tokens_list,
      p_api_output_tokens_list: api_output_tokens_list,
      p_api_completion_tokens: api_completion_tokens,
      p_response_time_ms: response_time_ms,
      p_is_success: is_success,
      p_error_message: error_message,
    });

    if (insertErr) {
      console.error("❌ SUPABASE TOKEN UPSERT FAILED", {
        code: insertErr.code,
        message: insertErr.message,
        details: insertErr.details,
        hint: insertErr.hint,
        user_id,
        email,
        task_type,
      });
      return;
    }

    console.log("✅ SUPABASE TOKEN INSERT SUCCESS");
  } catch (loggingError) {
    // Usage logging must never turn a successful AI response into an API error.
    console.error("❌ Azure token usage logging failed:", loggingError);
>>>>>>> feef1e883ec1c68c2bb1718de9d1ca284e5f8455
  }
}
