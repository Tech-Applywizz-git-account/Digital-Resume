
import { createClient } from '@supabase/supabase-js';

const LOCAL_URL = "https://qzzbvgdcnkmjargleluy.supabase.co";
const LOCAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM";

const usersToCreate = [
    {
        email: 'venkatavasavi99@gmail.com',
        profileId: '3a05f579-8b23-4cfa-a925-6a1a3f011337',
        name: 'Venkata Sai Vasavi'
    },
    {
        email: 'Sushruthapatlolla15@gmail.com',
        profileId: '259d1907-d977-4a4a-83d7-e50991123241',
        name: 'Sushruthapatlolla'
    }
];

async function createUsersWithNewIds() {
    const local = createClient(LOCAL_URL, LOCAL_KEY);

    for (const user of usersToCreate) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔧 Creating auth for: ${user.email}`);
        console.log('='.repeat(60));

        try {
            // Create auth user WITHOUT specifying ID (let Supabase generate it)
            console.log(`🔨 Creating new auth account...`);

            const { data: newAuthUser, error: authError } = await local.auth.admin.createUser({
                email: user.email,
                password: 'Applywizz@123',
                email_confirm: true,
                user_metadata: {
                    name: user.name
                }
            });

            if (authError) {
                console.error('❌ Failed to create auth user:', authError.message);

                // If it says already exists, try to find and update the profile
                if (authError.message.includes('already been registered')) {
                    console.log('⚠️  User seems to exist in a hidden state.');
                    console.log('   This requires manual intervention in Supabase dashboard.');
                    console.log('   Go to: Authentication > Users > Search for email');
                    console.log('   Then delete the user and run this script again.');
                }
                continue;
            }

            const newUserId = newAuthUser.user?.id;
            console.log(`✅ Auth account created!`);
            console.log(`   New Auth ID: ${newUserId}`);
            console.log(`   Email: ${newAuthUser.user?.email}`);

            // Update the existing profile to use the new auth ID
            console.log(`\n🔄 Updating profile to use new auth ID...`);

            // First, delete the old profile
            const { error: deleteError } = await local
                .from('profiles')
                .delete()
                .eq('id', user.profileId);

            if (deleteError) {
                console.error('⚠️  Warning: Could not delete old profile:', deleteError.message);
            } else {
                console.log(`✅ Old profile deleted`);
            }

            // Create new profile with new ID
            const { error: profileError } = await local
                .from('profiles')
                .insert({
                    id: newUserId,
                    email: user.email,
                    credits_remaining: 4,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (profileError) {
                console.error('❌ Failed to create new profile:', profileError.message);
            } else {
                console.log(`✅ New profile created with 4 credits`);
            }

            // Create CRM tracking record
            const { error: crmError } = await local
                .from('digital_resume_by_crm')
                .insert({
                    email: user.email,
                    user_id: newUserId,
                    credits_remaining: 4,
                    payment_details: {
                        source: 'MANUAL_FIX',
                        fixed_at: new Date().toISOString(),
                        reason: 'Recreated auth account with new ID',
                        old_profile_id: user.profileId
                    },
                    user_created_at: new Date().toISOString(),
                    last_sync_at: new Date().toISOString(),
                    is_active: true
                });

            if (crmError) {
                console.warn('⚠️  Warning: Failed to create CRM tracking record:', crmError.message);
            } else {
                console.log(`✅ CRM tracking record created`);
            }

            // Create dashboard stats
            const { error: statsError } = await local
                .from('crm_dashboard_stats')
                .insert({
                    email: user.email,
                    user_id: newUserId,
                    total_applications: 0,
                    total_recordings: 0,
                    total_resumes: 0,
                    total_views: 0,
                    last_login_date: new Date().toISOString()
                });

            if (statsError) {
                console.warn('⚠️  Warning: Failed to create dashboard stats:', statsError.message);
            } else {
                console.log(`✅ Dashboard stats created`);
            }

            console.log(`\n✅ SUCCESS! User ${user.email} can now log in with:`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Password: Applywizz@123`);
            console.log(`   Credits: 4`);

        } catch (error: any) {
            console.error(`❌ Error creating ${user.email}:`, error.message);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 Creation process completed!');
    console.log('='.repeat(60));
}

createUsersWithNewIds();
