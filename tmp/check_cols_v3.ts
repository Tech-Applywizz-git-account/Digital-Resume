
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  let output = '';
  const { data } = await supabase.from('job_requests').select('*').limit(1);
  if (data && data.length > 0) {
    output += 'JOB_REQUESTS_COLS:' + JSON.stringify(Object.keys(data[0])) + '\n';
  }

  const { data: crmData } = await supabase.from('crm_job_requests').select('*').limit(1);
  if (crmData && crmData.length > 0) {
    output += 'CRM_JOB_REQUESTS_COLS:' + JSON.stringify(Object.keys(crmData[0])) + '\n';
  }
  fs.writeFileSync('tmp/cols_output.txt', output);
}
checkColumns();
