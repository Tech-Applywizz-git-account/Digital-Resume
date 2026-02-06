
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qzzbvgdcnkmjargleluy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MDg5MjMsImV4cCI6MjA2NzAyMzA1MH0.DtSE47b-GLzZUb7dEAA_KJMzCTCHIMqS5kcJdIaSlJ4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
    const email = 'sushruthapatlolla15@gmail.com';
    const password = 'Applywizz@123';

    console.log(`Testing login for: ${email}`);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error('❌ Login Failed:', error.message);
    } else {
        console.log('✅ Login Successful!');
        console.log('User ID:', data.user.id);
    }
}

testLogin();
