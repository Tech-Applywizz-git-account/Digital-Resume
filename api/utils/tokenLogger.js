import { createClient } from "@supabase/supabase-js";

/**
 * Logs a single Azure OpenAI API call to `public.azure_token_usage`.
 *
 * User resolution strategy (server-side only):
 *   1. Receive `user_id` — the portfolio owner's ID.
 * User resolution strategy:
 *   1. Receive `user_id` — the authenticated Supabase user or portfolio owner ID.
 *   2. Query `public.digital_resume_by_crm` by user_id to get the authoritative `email`.
 *   3. If the CRM record is missing or email is NULL → log error, skip logging.
 *      The Azure response is never blocked by logging failures.
 *   3. Fall back to `auth.users` / `profiles` if CRM lookup is not yet synced.
 *   4. Atomically aggregate into `public.azure_token_usage` for (user_id, product='digital_resume', task_type, task_date).
 *   2. Use explicit `email` if provided; otherwise query `public.digital_resume_by_crm` by `user_id`.
 *   3. If CRM lookup is missing, fall back to `profiles` table.
 *   4. If email is still unresolved, log warning and abort (since `email` column is NOT NULL).
 *   5. Directly aggregate into `public.azure_token_usage` for (user_id, product='digital_resume', task_type, task_date).
 *
 * @param {Object}       options
 * @param {string}       options.user_id           - Portfolio owner's ID (required)
 * @param {string}       options.user_id           - Supabase Auth UUID (required)
 * @param {string}       options.task_type         - 'generate_introduction' | 'resume_chat' | 'rerecording'
 * @param {string}       options.model             - Model name from Azure response
 * @param {string}       options.model             - Model identifier from Azure OpenAI response
 * @param {string|null}  [options.deployment_name] - Azure deployment name
 * @param {string|null}  [options.azure_request_id]- Azure response .id field
 * @param {Object|null}  [options.usage]           - completionResponse.usage from Azure SDK
 * @param {number|null}  [options.response_time_ms]- Wall-clock ms for the Azure call
 * @param {boolean}      [options.is_success]      - Whether the Azure call succeeded
 * @param {string|null}  [options.error_message]   - Error message on failure
 * @param {number|null}  [options.lead_id]         - Optional integer lead ID
 * @param {string|null}  [options.email]           - Optional explicit email
 * @param {string}       [options.product]         - Product identifier (default: 'digital_resume')
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
    email: rawEmail  = null,
    product          = 'digital_resume',
  } = options;

  // ── 1. Validate inputs ──────────────────────────────────────────────────────
  const user_id = rawUserId || null;
  const resolvedModel = model || deployment_name || process.env.AZURE_OPENAI_MODEL || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5-mini';

  console.log("========== AZURE TOKEN LOGGER START ==========");
  console.log("Product:", product);
  console.log("Task Type:", task_type);
  console.log("User ID:", user_id);
  console.log("Lead ID:", lead_id);
  console.log("Model:", model);
  console.log("Model:", resolvedModel);
  console.log("Deployment:", deployment_name);
  console.log("Azure Request ID:", azure_request_id);

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
  const supabaseUrl        = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ logAzureUsage: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // ── 2. Resolve email from digital_resume_by_crm ──────────────────────────
  let email = null;
  // ── 2. Request Idempotency Check ──────────────────────────────────────────
  if (azure_request_id) {
    try {
      const { error: reqErr } = await supabaseAdmin
        .from('azure_token_usage_requests')
        .insert({ azure_request_id });

  try {
    const { data: crmRecord, error: crmErr } = await supabaseAdmin
      .from('digital_resume_by_crm')
      .select('email, user_id')
      .eq('user_id', user_id)
      .maybeSingle();
    // ── 2. Resolve email (required because email column is NOT NULL) ──────────
    let email = rawEmail ? rawEmail.trim().toLowerCase() : null;

    console.log("========== CRM LOOKUP ==========");
    console.log("Lookup by user_id:", user_id);
    console.log("CRM record found:", !!crmRecord);
    console.log("CRM email:", crmRecord?.email || null);
    console.log("CRM user_id:", crmRecord?.user_id || null);
    if (!email) {
      try {
        const { data: crmRecord, error: crmErr } = await supabaseAdmin
          .from('digital_resume_by_crm')
          .select('email')
          .eq('user_id', user_id)
          .maybeSingle();

    if (crmErr) {
      console.error("CRM error:", {
        code: crmErr.code,
        message: crmErr.message,
        details: crmErr.details,
        hint: crmErr.hint,
      });
      if (reqErr) {
        if (reqErr.code === '23505' || reqErr.message?.includes('duplicate key')) {
          console.warn(`⚠️ logAzureUsage: Request ID "${azure_request_id}" already processed. Skipping duplicate log.`);
          return;
        if (crmErr) {
          console.warn("⚠️ logAzureUsage: CRM lookup warning:", crmErr.message);
        }
        // If table has missing columns or error, log but continue
        console.warn("⚠️ logAzureUsage: azure_token_usage_requests note:", reqErr.message);
      }
    } catch (idempErr) {
      console.warn("⚠️ logAzureUsage: Idempotency check warning:", idempErr?.message);
    }
  }

    console.log("================================");
  // ── 3. Resolve email from digital_resume_by_crm / profiles ────────────────
  let email = rawEmail ? rawEmail.trim().toLowerCase() : null;
        if (crmRecord?.email) {
          email = crmRecord.email.trim().toLowerCase();
        } else {
          // Fallback: check profiles table
          const { data: profileRecord } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('id', user_id)
            .maybeSingle();

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
  if (!email) {
    try {
      const { data: crmRecord, error: crmErr } = await supabaseAdmin
        .from('digital_resume_by_crm')
        .select('email, user_id')
        .eq('user_id', user_id)
        .maybeSingle();

    if (!crmRecord) {
      console.error(
        `❌ logAzureUsage: No digital_resume_by_crm record found for user_id="${user_id}". ` +
        `Token usage for task_type="${task_type}" will NOT be saved.`
      );
      return;
      if (crmRecord?.email) {
        email = crmRecord.email.trim().toLowerCase();
      } else {
        // Fallback: check profiles table
        const { data: profileRecord } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', user_id)
          .maybeSingle();
        if (profileRecord?.email) {
          email = profileRecord.email.trim().toLowerCase();
          if (profileRecord?.email) {
            email = profileRecord.email.trim().toLowerCase();
          }
        }
      } catch (lookupErr) {
        console.error("❌ logAzureUsage: Error resolving user email:", lookupErr?.message);
      }
    } catch (lookupErr) {
      console.error("❌ logAzureUsage: Error resolving user email:", lookupErr?.message);
    }
  }

    if (!crmRecord.email) {
    if (!email) {
      console.error(
        `❌ logAzureUsage: digital_resume_by_crm.email is NULL for user_id="${user_id}". ` +
        `Token usage for task_type="${task_type}" will NOT be saved.`
        `❌ logAzureUsage: Unable to resolve email for user_id="${user_id}". ` +
        `Token usage for task_type="${task_type}" cannot be saved.`
      );
      return;
    }

    email = crmRecord.email.trim().toLowerCase();
    // ── 3. Map Azure token counts ─────────────────────────────────────────────
    const usages = Array.isArray(usage) ? usage : (usage ? [usage] : []);

  } catch (lookupErr) {
    console.error("❌ logAzureUsage: Unexpected error during CRM lookup.", lookupErr?.message);
  if (!email) {
    console.error(
      `❌ logAzureUsage: Unable to resolve email for user_id="${user_id}". ` +
      `Token usage for task_type="${task_type}" cannot be saved.`
    );
    return;
  }
    let total_input_tokens = 0;
    let total_output_tokens = 0;
    let total_completion_tokens = 0;

  // ── 3. Map Azure token counts ───────────────────────────────────────────────
  // ── 4. Map Azure token counts ─────────────────────────────────────────────
  // Exact values from completionResponse.usage — never estimated or hardcoded.
  const usages = Array.isArray(usage) ? usage : (usage ? [usage] : []);
    const input_tokens_list = [];
    const output_tokens_list = [];
    const completion_tokens_list = [];

  let total_input_tokens = 0;
  let total_output_tokens = 0;
  let total_completion_tokens = 0;
    const numericTokenCount = (value) => {
      const count = Number(value);
      return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
    };

  const input_tokens_list = [];
  const output_tokens_list = [];
  const completion_tokens_list = [];
    for (const u of usages) {
      const pTokens = numericTokenCount(u?.prompt_tokens);
      const cTokens = numericTokenCount(u?.completion_tokens);
      const tTokens = numericTokenCount(u?.total_tokens);

  const numericTokenCount = (value) => {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  };
      total_input_tokens += pTokens;
      total_output_tokens += cTokens;
      total_completion_tokens += tTokens;

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
      input_tokens_list.push(pTokens);
      output_tokens_list.push(cTokens);
      completion_tokens_list.push(tTokens);
    }
  }

  // Strictly comma-separated numeric strings, NO brackets or JSON objects
  const api_input_tokens_list = input_tokens_list.join(',');
  const api_output_tokens_list = output_tokens_list.join(',');
  const api_completion_tokens = completion_tokens_list.join(',');
    // Strictly comma-separated numeric strings, NO brackets or JSON objects
    const api_input_tokens_list = input_tokens_list.join(',');
    const api_output_tokens_list = output_tokens_list.join(',');
    const api_completion_tokens = completion_tokens_list.join(',');
    const task_date = new Date().toISOString().split('T')[0];

  // ── 4. Atomically aggregate into azure_token_usage ─────────────────────────
  const task_date = new Date().toISOString().split('T')[0];
    console.log("========== TOKEN DATA BEFORE SAVE ==========");
    console.log("user_id:", user_id);
    console.log("email:", email);
    console.log("product:", product);
    console.log("task_type:", task_type);
    console.log("task_date:", task_date);
    console.log("model:", resolvedModel);
    console.log("deployment_name:", deployment_name);
    console.log("inputTokensList:", api_input_tokens_list);
    console.log("outputTokensList:", api_output_tokens_list);
    console.log("completionTokensList:", api_completion_tokens);
    console.log("totalInputTokens:", total_input_tokens);
    console.log("totalOutputTokens:", total_output_tokens);
    console.log("totalCompletionTokens:", total_completion_tokens);
    console.log("============================================");

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
  console.log("product:", product);
  console.log("task_type:", task_type);
  console.log("input tokens:", total_input_tokens);
  console.log("output tokens:", total_output_tokens);
  console.log("total tokens:", total_completion_tokens);
  console.log("task_date:", task_date);
  console.log("model:", model);
  console.log("deployment_name:", deployment_name);
  console.log("inputTokensList:", api_input_tokens_list);
  console.log("outputTokensList:", api_output_tokens_list);
  console.log("completionTokensList:", api_completion_tokens);
  console.log("totalInputTokens:", total_input_tokens);
  console.log("totalOutputTokens:", total_output_tokens);
  console.log("totalCompletionTokens:", total_completion_tokens);
  console.log("=======================================");
    // ── 4. Save directly into public.azure_token_usage ────────────────────────
    // Find existing daily aggregation row for (user_id, product, task_type, task_date)
    const { data: existingRow, error: findErr } = await supabaseAdmin
      .from('azure_token_usage')
      .select('*')
      .eq('user_id', user_id)
      .eq('product', product)
      .eq('task_type', task_type)
      .eq('task_date', task_date)
      .maybeSingle();

  const task_date = new Date().toISOString().split('T')[0];

  // ── 5. Atomically aggregate into azure_token_usage ─────────────────────────
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
    // Attempt RPC first
    let rpcSucceeded = false;
    try {
      const { error: rpcErr } = await supabaseAdmin.rpc('upsert_azure_token_usage', {
        p_lead_id: lead_id || null,
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
        p_product: product,
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
      if (!rpcErr) {
        rpcSucceeded = true;
        console.log("✅ SUPABASE TOKEN RPC UPSERT SUCCESS");
      } else {
        console.warn("⚠️ RPC upsert_azure_token_usage returned error, using atomic table fallback:", rpcErr.message);
      }
    } catch (rpcCallErr) {
      console.warn("⚠️ RPC call exception, using table fallback:", rpcCallErr?.message);
    if (findErr) {
      console.warn("⚠️ Query existing azure_token_usage note:", findErr.message);
    }

    console.log("✅ SUPABASE TOKEN INSERT SUCCESS");
    if (!rpcSucceeded) {
      // Resilient Table Fallback: Find existing daily aggregation row for (user_id, product, task_type, task_date)
      const { data: existingRow, error: findErr } = await supabaseAdmin
    if (!existingRow) {
      // Insert new aggregation row
      const { error: insertErr } = await supabaseAdmin
        .from('azure_token_usage')
        .select('*')
        .eq('user_id', user_id)
        .eq('product', product)
        .eq('task_type', task_type)
        .eq('task_date', task_date)
        .maybeSingle();
        .insert({
          lead_id: lead_id || null,
          user_id: user_id,
          email: email,
          product: product,
          task_date: task_date,
          task_type: task_type,
          source: 'Azure OpenAI',
          model: resolvedModel,
          deployment_name: deployment_name,
          azure_request_id: azure_request_id,
          total_input_tokens: total_input_tokens,
          total_output_tokens: total_output_tokens,
          total_completion_tokens: total_completion_tokens,
          api_input_tokens_list: api_input_tokens_list,
          api_output_tokens_list: api_output_tokens_list,
          api_completion_tokens: api_completion_tokens,
          response_time_ms: response_time_ms,
          is_success: is_success,
          error_message: error_message,
        });

      if (findErr) {
        console.error("❌ Failed to query existing azure_token_usage row:", findErr.message);
      }
      if (insertErr) {
        if (insertErr.code === '23505') {
          // Concurrent insert race condition: fetch again and update
          const { data: retryRow } = await supabaseAdmin
            .from('azure_token_usage')
            .select('*')
            .eq('user_id', user_id)
            .eq('product', product)
            .eq('task_type', task_type)
            .eq('task_date', task_date)
            .maybeSingle();

      if (!existingRow) {
        // Insert new aggregation row
        const { error: insertErr } = await supabaseAdmin
          .from('azure_token_usage')
          .insert({
            lead_id: lead_id || null,
            user_id: user_id,
            email: email,
            product: product,
            task_date: task_date,
            task_type: task_type,
            source: 'Azure OpenAI',
            model: model,
            deployment_name: deployment_name,
            azure_request_id: azure_request_id,
            total_input_tokens: total_input_tokens,
            total_output_tokens: total_output_tokens,
            total_completion_tokens: total_completion_tokens,
            api_input_tokens_list: api_input_tokens_list,
            api_output_tokens_list: api_output_tokens_list,
            api_completion_tokens: api_completion_tokens,
            response_time_ms: response_time_ms,
            is_success: is_success,
            error_message: error_message,
          });

        if (insertErr) {
          if (insertErr.code === '23505') {
            // Concurrent insert race condition: fetch again and update
            const { data: retryRow } = await supabaseAdmin
              .from('azure_token_usage')
              .select('*')
              .eq('user_id', user_id)
              .eq('product', product)
              .eq('task_type', task_type)
              .eq('task_date', task_date)
              .maybeSingle();

            if (retryRow) {
              await updateExistingRow(supabaseAdmin, retryRow, {
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
                product,
              });
            }
          } else {
            console.error("❌ SUPABASE TOKEN INSERT FAILED:", insertErr);
          if (retryRow) {
            await updateExistingRow(supabaseAdmin, retryRow, {
              model: resolvedModel,
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
              product,
            });
          }
        } else {
          console.log("✅ SUPABASE TOKEN ROW INSERTED SUCCESSFULLY");
          console.error("❌ SUPABASE TOKEN INSERT FAILED:", insertErr);
        }
      } else {
        // Row exists: update and append tokens
        await updateExistingRow(supabaseAdmin, existingRow, {
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
          product,
        });
        console.log("✅ SUPABASE TOKEN ROW INSERTED SUCCESSFULLY");
      }
    } else {
      // Row exists: update and append tokens
      await updateExistingRow(supabaseAdmin, existingRow, {
        model: resolvedModel,
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
        product,
      });
    }
  } catch (loggingError) {
    // Usage logging must never turn a successful AI response into an API error.
    console.error("❌ Azure token usage logging failed:", loggingError);
  }
}

/**
 * Helper to update an existing aggregation row by appending token lists and incrementing totals.
 */
async function updateExistingRow(supabaseAdmin, existing, newValues) {
  const appendTokens = (existingList, newList) => {
    if (!existingList && !newList) return '';
    if (!existingList) return newList;
    if (!newList) return existingList;
    return `${existingList},${newList}`;
  };

  const updatedInputList = appendTokens(existing.api_input_tokens_list, newValues.api_input_tokens_list);
  const updatedOutputList = appendTokens(existing.api_output_tokens_list, newValues.api_output_tokens_list);
  const updatedCompletionList = appendTokens(existing.api_completion_tokens, newValues.api_completion_tokens);

  const { error: updateErr } = await supabaseAdmin
    .from('azure_token_usage')
    .update({
      product: newValues.product || 'digital_resume',
      model: newValues.model,
      deployment_name: newValues.deployment_name,
      azure_request_id: newValues.azure_request_id || existing.azure_request_id,
      total_input_tokens: (existing.total_input_tokens || 0) + newValues.total_input_tokens,
      total_output_tokens: (existing.total_output_tokens || 0) + newValues.total_output_tokens,
      total_completion_tokens: (existing.total_completion_tokens || 0) + newValues.total_completion_tokens,
      api_input_tokens_list: updatedInputList,
      api_output_tokens_list: updatedOutputList,
      api_completion_tokens: updatedCompletionList,
      response_time_ms: (existing.response_time_ms || 0) + (newValues.response_time_ms || 0),
      is_success: newValues.is_success,
      error_message: newValues.error_message || null,
    })
    .eq('id', existing.id);

  if (updateErr) {
    console.error("❌ SUPABASE TOKEN ROW UPDATE FAILED:", updateErr);
  } else {
    console.log("✅ SUPABASE TOKEN ROW AGGREGATED SUCCESSFULLY");
  }
}

