import { createClient } from "@supabase/supabase-js";

/**
 * Logs a single Azure OpenAI API call to `public.azure_token_usage`.
 *
 * User resolution strategy:
 *   1. Receive `user_id` — the authenticated Supabase user or portfolio owner ID.
 *   2. Use explicit `email` if provided; otherwise query `public.digital_resume_by_crm` by `user_id`.
 *   3. If CRM lookup is missing, fall back to `profiles` table.
 *   4. If email is still unresolved, log warning and abort (since `email` column is NOT NULL).
 *   5. Directly aggregate into `public.azure_token_usage` for (user_id, product='digital_resume', task_type, task_date).
 *
 * @param {Object}       options
 * @param {string}       options.user_id           - Supabase Auth UUID (required)
 * @param {string}       options.task_type         - 'generate_introduction' | 'resume_chat' | 'rerecording'
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
  console.log("Model:", resolvedModel);
  console.log("Deployment:", deployment_name);
  console.log("Azure Request ID:", azure_request_id);
  console.log("==============================================");

  if (!user_id) {
    console.error("❌ logAzureUsage: `user_id` is required.", { task_type });
    return;
  }

  const supabaseUrl        = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ logAzureUsage: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ── 2. Resolve email (required because email column is NOT NULL) ──────────
    let email = rawEmail ? rawEmail.trim().toLowerCase() : null;

    if (!email) {
      try {
        const { data: crmRecord, error: crmErr } = await supabaseAdmin
          .from('digital_resume_by_crm')
          .select('email')
          .eq('user_id', user_id)
          .maybeSingle();

        if (crmErr) {
          console.warn("⚠️ logAzureUsage: CRM lookup warning:", crmErr.message);
        }

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
          }
        }
      } catch (lookupErr) {
        console.error("❌ logAzureUsage: Error resolving user email:", lookupErr?.message);
      }
    }

    if (!email) {
      console.error(
        `❌ logAzureUsage: Unable to resolve email for user_id="${user_id}". ` +
        `Token usage for task_type="${task_type}" cannot be saved.`
      );
      return;
    }

    // ── 3. Map Azure token counts ─────────────────────────────────────────────
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
    }

    // Strictly comma-separated numeric strings, NO brackets or JSON objects
    const api_input_tokens_list = input_tokens_list.join(',');
    const api_output_tokens_list = output_tokens_list.join(',');
    const api_completion_tokens = completion_tokens_list.join(',');
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

    if (findErr) {
      console.warn("⚠️ Query existing azure_token_usage note:", findErr.message);
    }

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
          console.error("❌ SUPABASE TOKEN INSERT FAILED:", insertErr);
        }
      } else {
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

