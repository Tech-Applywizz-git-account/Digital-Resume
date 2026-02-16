
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function debugUser() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const emailToCheck = "prabhuprabhuchaitanyamolabant2@gmail.com".toLowerCase();

    const { data: crmData } = await supabase
        .from('digital_resume_by_crm')
        .select('*')
        .or(`email.eq.${emailToCheck},company_application_email.eq.${emailToCheck}`);

    console.log("SEARCH_RESULT_START");
    if (!crmData || crmData.length === 0) {
        console.log("NO_CRM_RECORD");
    } else {
        const row = crmData[0];
        console.log("PRIMARY_EMAIL:" + row.email);
        console.log("COMPANY_EMAIL:" + row.company_application_email);
        console.log("USER_ID:" + row.user_id);

        const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id);
        if (authUser) {
            console.log("AUTH_USER_EMAIL:" + authUser.user.email);
            console.log("AUTH_USER_CONFIRMED:" + !!authUser.user.email_confirmed_at);
        } else {
            console.log("AUTH_USER_NOT_FOUND");
        }
    }
    console.log("SEARCH_RESULT_END");
}

debugUser();
