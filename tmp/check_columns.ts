
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addColumns() {
  console.log('Attempting to add teleprompter_speed column...');
  
  // Note: We can't run raw SQL easily via the JS SDK without RPC or a special endpoint.
  // But we can check if the column exists by trying to select it.
  
  const { error: check1 } = await supabase.from('job_requests').select('teleprompter_speed').limit(1);
  if (check1) {
     console.log('Column teleprompter_speed does not exist in job_requests or error occurred.');
  } else {
     console.log('Column teleprompter_speed already exists in job_requests.');
  }

  const { error: check2 } = await supabase.from('crm_job_requests').select('teleprompter_speed').limit(1);
  if (check2) {
     console.log('Column teleprompter_speed does not exist in crm_job_requests or error occurred.');
  } else {
     console.log('Column teleprompter_speed already exists in crm_job_requests.');
  }
}

addColumns();
