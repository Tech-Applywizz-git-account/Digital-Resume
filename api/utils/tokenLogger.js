import { createClient } from "@supabase/supabase-js";

/**
 * Logs a single Azure OpenAI API call to `public.azure_token_usage`.
 *
 * User resolution strategy (server-side only):
 *   1. Receive `email` — the portfolio owner's authenticated email.
 *   2. Query `public.digital_resume_by_crm` by email to get the authoritative
 *      `user_id` (→ auth.users.id).
 *   3. If the CRM record is missing or user_id is NULL → log error, skip insert.
 *      The Azure response is never blocked by logging failures.
 *
 * @param {Object}       options
 * @param {string}       options.email             - Portfolio owner's email (required)
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
    email: rawEmail,
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
  const email = rawEmail ? rawEmail.trim().toLowerCase() : null;

  if (!email) {
    console.error("❌ logAzureUsage: `email` is required but was not provided.", { task_type });
    return;
  }

  const supabaseUrl      = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ logAzureUsage: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // ── 2. Resolve user_id from digital_resume_by_crm ──────────────────────────
  let user_id = null;

  try {
    const { data: crmRecord, error: crmErr } = await supabaseAdmin
      .from('digital_resume_by_crm')
      .select('email, user_id')
      .eq('email', email)
      .maybeSingle();

    if (crmErr) {
      console.error("❌ logAzureUsage: CRM lookup failed.", {
        code:    crmErr.code,
        message: crmErr.message,
        details: crmErr.details,
        hint:    crmErr.hint,
        email,
        task_type,
      });
      return;
    }

    if (!crmRecord) {
      console.error(
        `❌ logAzureUsage: No digital_resume_by_crm record found for email="${email}". ` +
        `Token usage for task_type="${task_type}" will NOT be saved. ` +
        `Add this user to digital_resume_by_crm to enable logging.`
      );
      return;
    }

    if (!crmRecord.user_id) {
      console.error(
        `❌ logAzureUsage: digital_resume_by_crm.user_id is NULL for email="${email}". ` +
        `Token usage for task_type="${task_type}" will NOT be saved. ` +
        `Populate user_id in digital_resume_by_crm to enable logging.`
      );
      return;
    }

    user_id = crmRecord.user_id;
    console.log(`✅ logAzureUsage: Resolved user_id="${user_id}" for email="${email}" via digital_resume_by_crm.`);

  } catch (lookupErr) {
    console.error("❌ logAzureUsage: Unexpected error during CRM lookup.", lookupErr?.message);
    return;
  }

  // ── 3. Map Azure token counts ───────────────────────────────────────────────
  // Exact values from completionResponse.usage — never estimated or hardcoded.
  const total_input_tokens      = usage?.prompt_tokens      ?? 0;
  const total_output_tokens     = usage?.completion_tokens  ?? 0;
  const total_completion_tokens = usage?.total_tokens       ?? 0;

  // Store per-request breakdown in the JSONB arrays.
  // For a single call: [actual_value]. Granular details kept if Azure returns them.
  const api_input_tokens_list = usage?.prompt_tokens_details
    ? [usage.prompt_tokens_details]
    : [total_input_tokens];

  const api_output_tokens_list = usage?.completion_tokens_details
    ? [usage.completion_tokens_details]
    : [total_output_tokens];

  const api_completion_tokens = [total_completion_tokens];

  // ── 4. Insert into azure_token_usage ───────────────────────────────────────
  try {
    console.log(`📝 logAzureUsage: Inserting row — email="${email}", user_id="${user_id}", task_type="${task_type}", model="${model}"`);

    const { error: insertErr } = await supabaseAdmin
      .from('azure_token_usage')
      .insert({
        lead_id,
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
      console.error(`❌ logAzureUsage: Supabase insert failed for task_type="${task_type}".`, {
        code:    insertErr.code,
        message: insertErr.message,
        details: insertErr.details,
        hint:    insertErr.hint,
        user_id,
        email,
        task_type,
      });
    } else {
      console.log(
        `📊 logAzureUsage ✅ [${task_type}] ` +
        `input=${total_input_tokens} output=${total_output_tokens} total=${total_completion_tokens} ` +
        `success=${is_success} response_ms=${response_time_ms ?? 'n/a'}`
      );
    }
  } catch (insertCatchErr) {
    console.error("❌ logAzureUsage: Unexpected error during insert.", insertCatchErr?.message);
  }
}
