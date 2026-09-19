import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const LOCAL_URL = "https://qzzbvgdcnkmjargleluy.supabase.co";
const LOCAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM";

const supabase = createClient(LOCAL_URL, LOCAL_KEY);

async function testUnique() {
  const req1 = crypto.randomUUID();
  const req2 = crypto.randomUUID();
  const uid = crypto.randomUUID();
  const email = "test_unique@example.com";

  await supabase.from('portfolio_settings').insert({
    request_id: req1,
    url: "https://p1.com",
    user_id: uid,
    email: email
  });

  // try inserting another with same user_id
  const { error: err1 } = await supabase.from('portfolio_settings').insert({
    request_id: req2,
    url: "https://p2.com",
    user_id: uid,
    email: "another@example.com"
  });
  console.log('Duplicate user_id error:', err1);

  // cleanup
  await supabase.from('portfolio_settings').delete().eq('request_id', req1);
  if (!err1) {
    await supabase.from('portfolio_settings').delete().eq('request_id', req2);
  }
}

testUnique();
