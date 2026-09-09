import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Logs a single Azure OpenAI API call to `public.azure_token_usage` for Deno Supabase Edge Functions.
 */
export async function logAzureUsage(options: any) {
  const {
    lead_id,
    user_id,
    email: rawEmail,
    task_type,
    source,
    model,
    deployment_name = null,
    azure_request_id = null,
    api_calls,
    response_time_ms = null,
    is_success = true,
    error_message = null,
    product = 'digital_resume',
  } = options;

  if (!user_id) {
    console.error("Missing user_id for Azure token logging", { task_type });
    return;
  }

  const calls = Array.isArray(api_calls) ? api_calls : (api_calls ? [api_calls] : []);
  const numericTokenCount = (value: unknown): number => {
    const count = Number(value);
    return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  };
  
  const inputTokens = calls.map((call: any) => numericTokenCount(call?.prompt_tokens));
  const outputTokens = calls.map((call: any) => numericTokenCount(call?.completion_tokens));
  const completionTokens = calls.map((call: any) => numericTokenCount(call?.total_tokens));
  const total_input_tokens = inputTokens.reduce((sum, value) => sum + value, 0);
  const total_output_tokens = outputTokens.reduce((sum, value) => sum + value, 0);
  const total_completion_tokens = completionTokens.reduce((sum, value) => sum + value, 0);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials for token logging");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Resolve email from digital_resume_by_crm if not provided
    let resolvedEmail = rawEmail ? rawEmail.trim().toLowerCase() : null;
    if (!resolvedEmail) {
      const { data: crmRecord, error: crmError } = await supabaseAdmin
        .from("digital_resume_by_crm")
        .select("email")
        .eq("user_id", user_id)
        .maybeSingle();
      if (crmError) console.warn("CRM lookup warning:", crmError.message);
      resolvedEmail = crmRecord?.email?.trim().toLowerCase() || null;
    }

    if (!resolvedEmail) {
      console.error(`No email found for user_id="${user_id}". Token usage will NOT be saved.`);
      return;
    }

    const task_date = new Date().toISOString().split("T")[0];
    const resolvedModel = model || deployment_name || Deno.env.get("AZURE_OPENAI_MODEL") || Deno.env.get("AZURE_OPENAI_DEPLOYMENT") || "gpt-5-mini";

    // Strictly comma-separated numeric strings — NO brackets or JSON objects
    const api_input_tokens_list = inputTokens.join(",");
    const api_output_tokens_list = outputTokens.join(",");
    const api_completion_tokens_str = completionTokens.join(",");

    console.log("TOKEN DATA BEFORE SUPABASE SAVE:", {
      product,
      task_type,
      model: resolvedModel,
      deployment_name,
      inputTokensList: api_input_tokens_list,
      outputTokensList: api_output_tokens_list,
      completionTokensList: api_completion_tokens_str,
      totalInputTokens: total_input_tokens,
      totalOutputTokens: total_output_tokens,
      totalCompletionTokens: total_completion_tokens
    });

    // Save directly to azure_token_usage table with atomic aggregation
    const { data: existingRow } = await supabaseAdmin
      .from("azure_token_usage")
      .select("*")
      .eq("user_id", user_id)
      .eq("product", product)
      .eq("task_type", task_type)
      .eq("task_date", task_date)
      .maybeSingle();

    if (!existingRow) {
      const { error: insertErr } = await supabaseAdmin
        .from("azure_token_usage")
        .insert({
          lead_id: lead_id ?? null,
          user_id,
          email: resolvedEmail,
          product,
          task_date,
          task_type,
          source: source || "Azure OpenAI",
          model: resolvedModel,
          deployment_name,
          azure_request_id,
          total_input_tokens,
          total_output_tokens,
          total_completion_tokens,
          api_input_tokens_list,
          api_output_tokens_list,
          api_completion_tokens: api_completion_tokens_str,
          response_time_ms,
          is_success,
          error_message,
        });
      if (insertErr) console.error("❌ Token usage insert failed:", insertErr);
      else console.log(`✅ Token usage inserted for ${task_type}. Total tokens: ${total_completion_tokens}`);
    } else {
      const appendList = (a: string, b: string) => {
        if (!a && !b) return "";
        if (!a) return b;
        if (!b) return a;
        return `${a},${b}`;
      };
      const { error: updateErr } = await supabaseAdmin
        .from("azure_token_usage")
        .update({
          product,
          model: resolvedModel || existingRow.model,
          deployment_name: deployment_name || existingRow.deployment_name,
          azure_request_id: azure_request_id || existingRow.azure_request_id,
          total_input_tokens: (existingRow.total_input_tokens || 0) + total_input_tokens,
          total_output_tokens: (existingRow.total_output_tokens || 0) + total_output_tokens,
          total_completion_tokens: (existingRow.total_completion_tokens || 0) + total_completion_tokens,
          api_input_tokens_list: appendList(existingRow.api_input_tokens_list, api_input_tokens_list),
          api_output_tokens_list: appendList(existingRow.api_output_tokens_list, api_output_tokens_list),
          api_completion_tokens: appendList(existingRow.api_completion_tokens, api_completion_tokens_str),
          response_time_ms: (existingRow.response_time_ms || 0) + (response_time_ms || 0),
          is_success,
          error_message: error_message || null,
        })
        .eq("id", existingRow.id);
      if (updateErr) console.error("❌ Token usage update failed:", updateErr);
      else console.log(`✅ Token usage aggregated for ${task_type}. Total tokens: ${total_completion_tokens}`);
    }
  } catch (err) {
    console.error("Azure token usage logging error:", err);
  }
}
