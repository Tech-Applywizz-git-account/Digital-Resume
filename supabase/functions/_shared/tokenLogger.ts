import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function logAzureUsage(options: any) {
  const {
    lead_id,
    task_type,
    source,
    model,
    api_calls
  } = options;

  if (!api_calls || api_calls.length === 0) return;

  const total_input_tokens = api_calls.reduce((sum: number, call: any) => sum + (call.prompt_tokens || 0), 0);
  const total_output_tokens = api_calls.reduce((sum: number, call: any) => sum + (call.completion_tokens || 0), 0);
  const total_completion_tokens = api_calls.reduce((sum: number, call: any) => sum + (call.total_tokens || 0), 0);
  
  const api_input_tokens_list = api_calls.map((call: any) => call.prompt_tokens || 0);
  const api_output_tokens_list = api_calls.map((call: any) => call.completion_tokens || 0);
  const api_completion_tokens = api_calls.map((call: any) => call.total_tokens || 0);
  
  api_calls.forEach((call: any, index: number) => {
    const rTokens = call?.completion_tokens_details?.reasoning_tokens;
    if (rTokens !== undefined) {
      console.log(`Azure OpenAI reasoning_tokens (call ${index + 1}):`, rTokens);
    }
  });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials for token logging");
    return;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log("TOKEN DATA BEFORE SUPABASE INSERT:", {
      inputTokensList: api_input_tokens_list,
      outputTokensList: api_output_tokens_list,
      completionTokensList: api_completion_tokens,
      totalInputTokens: total_input_tokens,
      totalOutputTokens: total_output_tokens,
      totalCompletionTokens: total_completion_tokens
    });
    
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
  }
}
