import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function logAzureUsage(options: any) {
  const {
    lead_id,
<<<<<<< HEAD
    task_type,
    source,
    model,
    api_calls
  } = options;

  if (!api_calls || api_calls.length === 0) return;

  const total_input_tokens = api_calls.reduce((sum: number, call: any) => sum + (call.prompt_tokens || 0), 0);
  const total_output_tokens = api_calls.reduce((sum: number, call: any) => sum + (call.completion_tokens || 0), 0);
  const total_completion_tokens = total_output_tokens;
  
  const api_input_tokens_list = api_calls.map((call: any) => call.prompt_tokens || 0);
  const api_output_tokens_list = api_calls.map((call: any) => call.completion_tokens || 0);
  const api_completion_tokens = api_output_tokens_list;
=======
    user_id,
    email,
    task_type,
    source,
    model,
    deployment_name = null,
    azure_request_id = null,
    api_calls,
    response_time_ms = null,
    is_success = true,
    error_message = null,
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
  
  calls.forEach((call: any, index: number) => {
    const rTokens = call?.completion_tokens_details?.reasoning_tokens;
    if (rTokens !== undefined) {
      console.log(`Azure OpenAI reasoning_tokens (call ${index + 1}):`, rTokens);
    }
  });
>>>>>>> feef1e883ec1c68c2bb1718de9d1ca284e5f8455

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials for token logging");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
<<<<<<< HEAD
    const { error } = await supabaseAdmin.from('azure_token_usage').insert({
      lead_id,
      task_date: new Date().toISOString(),
      task_type,
      source,
      model,
      total_input_tokens,
      total_output_tokens,
      total_completion_tokens,
      api_input_tokens_list,
      api_output_tokens_list,
      api_completion_tokens
    });

    if (error) {
      console.error("❌ Failed to log Azure token usage:", error);
    } else {
      console.log(`📊 Token Usage logged for ${task_type}. Total tokens: ${total_input_tokens + total_output_tokens}`);
    }
  } catch (err) {
    console.error("❌ Usage logging error:", err);
=======
    let resolvedEmail = email;
    if (!resolvedEmail) {
      const { data: crmRecord, error: crmError } = await supabaseAdmin
        .from("digital_resume_by_crm")
        .select("email")
        .eq("user_id", user_id)
        .maybeSingle();
      if (crmError) throw crmError;
      resolvedEmail = crmRecord?.email?.trim().toLowerCase() || null;
    }

    if (!resolvedEmail) {
      throw new Error(`No CRM email found for user_id="${user_id}"`);
    }

    console.log("TOKEN DATA BEFORE SUPABASE UPSERT:", {
      inputTokensList: inputTokens.join(","),
      outputTokensList: outputTokens.join(","),
      completionTokensList: completionTokens.join(","),
      totalInputTokens: total_input_tokens,
      totalOutputTokens: total_output_tokens,
      totalCompletionTokens: total_completion_tokens
    });

    const { error } = await supabaseAdmin.rpc("upsert_azure_token_usage", {
      p_lead_id: lead_id ?? null,
      p_user_id: user_id,
      p_email: resolvedEmail,
      p_task_date: new Date().toISOString().split("T")[0],
      p_task_type: task_type,
      p_source: source || "Azure OpenAI",
      p_model: model || null,
      p_deployment_name: deployment_name,
      p_azure_request_id: azure_request_id,
      p_total_input_tokens: total_input_tokens,
      p_total_output_tokens: total_output_tokens,
      p_total_completion_tokens: total_completion_tokens,
      p_api_input_tokens_list: inputTokens.join(","),
      p_api_output_tokens_list: outputTokens.join(","),
      p_api_completion_tokens: completionTokens.join(","),
      p_response_time_ms: response_time_ms,
      p_is_success: is_success,
      p_error_message: error_message,
    });

    if (error) {
      console.error("Failed to upsert Azure token usage:", error);
    } else {
      console.log(`Token usage upserted for ${task_type}. Total tokens: ${total_completion_tokens}`);
    }
  } catch (err) {
    console.error("Azure token usage logging error:", err);
>>>>>>> feef1e883ec1c68c2bb1718de9d1ca284e5f8455
  }
}
