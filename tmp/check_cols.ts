
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const { data, error } = await supabase.from('job_requests').select('*').limit(1);
  if (error) {
    console.error('Error fetching job_requests:', error);
  } else {
    console.log('job_requests columns:', Object.keys(data[0] || {}));
  }

  const { data: crmData, error: crmError } = await supabase.from('crm_job_requests').select('*').limit(1);
  if (crmError) {
    console.error('Error fetching crm_job_requests:', crmError);
  } else {
    console.log('crm_job_requests columns:', Object.keys(crmData[0] || {}));
  }
}

checkColumns();
