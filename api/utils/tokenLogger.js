import { createClient } from "@supabase/supabase-js";

/**
 * Logs a single Azure OpenAI API call to `public.azure_token_usage`.
 *
 * User resolution strategy (server-side only):
 *   1. Receive `user_id` — the portfolio owner's ID.
 *   2. Query `public.digital_resume_by_crm` by user_id to get the authoritative `email`.
 *   3. If the CRM record is missing or email is NULL → log error, skip insert.
 *      The Azure response is never blocked by logging failures.
 *
 * @param {Object}       options
 * @param {string}       options.user_id           - Portfolio owner's ID (required)
 * @param {string}       options.task_type         - 'generate_introduction' | 'resume_chat'
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
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

  for (const u of usages) {
    const pTokens = u?.prompt_tokens ?? 0;
    const cTokens = u?.completion_tokens ?? 0;
    const tTokens = u?.total_tokens ?? 0;

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

  const api_input_tokens_list = input_tokens_list.join(",");
  const api_output_tokens_list = output_tokens_list.join(",");
  const api_completion_tokens = completion_tokens_list.join(",");

  // ── 4. Insert into azure_token_usage ───────────────────────────────────────
  console.log("========== TOKEN INSERT DATA ==========");
  console.log("user_id:", user_id);
  console.log("email:", email);
  console.log("lead_id:", null);
  console.log("task_type:", task_type);
  console.log("input tokens:", total_input_tokens);
  console.log("output tokens:", total_output_tokens);
  console.log("total tokens:", total_completion_tokens);
  console.log("=======================================");

  const { error: insertErr } = await supabaseAdmin
    .from('azure_token_usage')
    .insert({
      lead_id: null,
      user_id,
      email,
      task_date:              new Date().toISOString().split('T')[0], // 'YYYY-MM-DD'
      task_type,
      source:                 'Azure OpenAI',
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
      // created_at → set automatically by Postgres: timezone('utc', now())
    });

  if (insertErr) {
    console.error("❌ SUPABASE TOKEN INSERT FAILED");

    console.error("Code:", insertErr.code);
    console.error("Message:", insertErr.message);
    console.error("Details:", insertErr.details);
    console.error("Hint:", insertErr.hint);

    console.error("User ID:", user_id);
    console.error("Email:", email);
    console.error("Task Type:", task_type);

    throw insertErr;
  }

  console.log("✅ SUPABASE TOKEN INSERT SUCCESS");
}
