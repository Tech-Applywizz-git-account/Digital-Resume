
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const { data } = await supabase.from('job_requests').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('JOB_REQUESTS_COLS:' + JSON.stringify(Object.keys(data[0])));
  } else {
    // If no data, try to get from rpc if available or just assume
    console.log('JOB_REQUESTS_EMPTY');
  }

  const { data: crmData } = await supabase.from('crm_job_requests').select('*').limit(1);
  if (crmData && crmData.length > 0) {
    console.log('CRM_JOB_REQUESTS_COLS:' + JSON.stringify(Object.keys(crmData[0])));
  } else {
    console.log('CRM_JOB_REQUESTS_EMPTY');
  }
}
checkColumns();
