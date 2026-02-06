
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qzzbvgdcnkmjargleluy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUser() {
    const email = 'sushruthapatlolla15@gmail.com';
    const userId = '259d1907-d977-4a4a-83d7-e50991123241';

    console.log(`Fixing user: ${email}`);

    // 1. Force Password Reset
    const { error: resetError } = await supabase.auth.admin.updateUserById(userId, {
        password: 'Applywizz@123',
        email_confirm: true
    });

    if (resetError) {
        console.error('❌ Failed to reset password:', resetError.message);
    } else {
        console.log('✅ Password successfully reset to Applywizz@123');
    }

    // 2. Ensure Profile exists
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!profile) {
        console.log('Creating missing profile...');
        await supabase.from('profiles').insert({
            id: userId,
            email: email,
            full_name: 'Sushrutha Patlolla'
        });
    }

    // 3. Add to digital_resume_by_crm if missing
    const { data: crmRecord } = await supabase.from('digital_resume_by_crm').select('id').eq('email', email).maybeSingle();
    if (!crmRecord) {
        console.log('Adding to digital_resume_by_crm with 4 credits...');
        const { error: insertError } = await supabase.from('digital_resume_by_crm').insert({
            email: email,
            user_id: userId,
            credits_remaining: 4,
            is_active: true,
            user_created_at: new Date().toISOString()
        });
        if (insertError) console.error('❌ CRM Insert Error:', insertError);
        else console.log('✅ Added to digital_resume_by_crm');
    }
}

fixUser();
