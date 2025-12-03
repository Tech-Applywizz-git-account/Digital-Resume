
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const usersToAdd = [
    { email: 'Dhakella@Applywizz.com', name: 'Dhakella' },
    { email: 'Sarika@Applywizz.com', name: 'Sarika' },
    { email: 'SaiSree@Applywizz.com', name: 'SaiSree' },
    { email: 'Pranavi@Applywizz.com', name: 'Pranavi' },
    { email: 'Yeshwanth@Applywizz.com', name: 'Yeshwanth' },
    { email: 'Lokesh@Applywizz.com', name: 'Lokesh' },
    { email: 'Mardhavan@Applywizz.com', name: 'Mardhavan' },
    { email: 'Mahvish@Applywizz.com', name: 'Mahvish' },
    { email: 'Jagan@Applywizz.com', name: 'Jagan' },
    { email: 'Manisha@Applywizz.com', name: 'Manisha' },
];

async function addUsers() {
    console.log(`🚀 Starting bulk user creation for ${usersToAdd.length} users...`);

    for (const user of usersToAdd) {
        try {
            console.log(`\nProcessing ${user.email}...`);

            // 1. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: 'Applywizz@123',
                email_confirm: true,
                user_metadata: { full_name: user.name }
            });

            if (authError) {
                console.error(`❌ Auth error for ${user.email}:`, authError.message);
                continue;
            }

            const userId = authData.user.id;
            console.log(`✅ Auth user created: ${userId}`);

            // 2. Create Profile with Credits
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: userId,
                    email: user.email,
                    credits_remaining: 4, // Default credits
                    full_name: user.name,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (profileError) {
                console.error(`❌ Profile error for ${user.email}:`, profileError.message);
            } else {
                console.log(`✅ Profile created with 4 credits`);
            }

            // 3. Add to CRM Tracking (Optional but good for consistency)
            const { error: crmError } = await supabase
                .from('digital_resume_by_crm')
                .insert({
                    email: user.email,
                    user_id: userId,
                    credits_remaining: 4,
                    payment_details: {
                        source: 'MANUAL_BULK',
                        created_by: 'script',
                        synced_at: new Date().toISOString(),
                    },
                    user_created_at: new Date().toISOString(),
                    last_sync_at: new Date().toISOString(),
                    is_active: true,
                });

            if (crmError) {
                console.error(`⚠️ CRM tracking error (non-fatal):`, crmError.message);
            } else {
                console.log(`✅ CRM tracking record created`);
            }

        } catch (err: any) {
            console.error(`❌ Unexpected error for ${user.email}:`, err.message);
        }
    }

    console.log('\n✨ Bulk user creation completed!');
}

addUsers();
