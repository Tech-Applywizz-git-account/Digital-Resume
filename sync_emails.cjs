
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qzzbvgdcnkmjargleluy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function synchronizeEmails() {
    const userId = '259d1907-d977-4a4a-83d7-e50991123241';
    const desiredEmail = 'sushruthapatlolla15@gmail.com';

    console.log(`Synchronizing emails for user ID: ${userId}`);
    console.log(`Setting primary email to: ${desiredEmail}`);

    // Update digital_resume_by_crm
    const { error: crmUpdateError } = await supabase
        .from('digital_resume_by_crm')
        .update({ email: desiredEmail })
        .eq('user_id', userId);

    if (crmUpdateError) {
        console.error('❌ CRM Update Error:', crmUpdateError);
    } else {
        console.log('✅ CRM tracking email updated.');
    }

    // Update profiles table
    const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ email: desiredEmail })
        .eq('id', userId);

    if (profileUpdateError) {
        console.error('❌ Profile Update Error:', profileUpdateError);
    } else {
        console.log('✅ Profile email updated.');
    }

    // Final verify
    const { data: verifyAuth } = await supabase.auth.admin.getUserById(userId);
    console.log('Final Auth Email:', verifyAuth.user.email);
}

synchronizeEmails();
