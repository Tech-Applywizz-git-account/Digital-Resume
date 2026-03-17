
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function addSpeedColumn() {
  console.log('Attempting to add teleprompter_speed to crm_job_requests...');
  // We can't run SQL directly. Let's see if we can use an RPC or just try to update a non-existent column to see the error.
  const { error } = await supabase.from('crm_job_requests').update({ teleprompter_speed: 1.0 } as any).eq('id', 'test');
  if (error && error.message.includes('column "teleprompter_speed" of relation "crm_job_requests" does not exist')) {
     console.log('Confirmed: column does not exist.');
  } else if (!error) {
     console.log('Update succeeded? Wait, that shouldn\'t happen if it doesn\'t exist.');
  } else {
     console.log('Error:', error.message);
  }
}
addSpeedColumn();
