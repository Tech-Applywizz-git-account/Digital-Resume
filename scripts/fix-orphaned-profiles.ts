
import { createClient } from '@supabase/supabase-js';

const LOCAL_URL = "https://qzzbvgdcnkmjargleluy.supabase.co";
const LOCAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM";

const usersToFix = [
    { email: 'venkatavasavi99@gmail.com', name: 'Venkata Sai Vasavi' },
    { email: 'Sushruthapatlolla15@gmail.com', name: 'Sushruthapatlolla' }
];

async function fixUsers() {
    const local = createClient(LOCAL_URL, LOCAL_KEY);

    for (const user of usersToFix) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔧 Fixing: ${user.email}`);
        console.log('='.repeat(60));

        try {
            // 1. Get the existing profile
            const { data: profile, error: profileError } = await local
                .from('profiles')
                .select('*')
                .eq('email', user.email)
                .maybeSingle();

            if (profileError) {
                console.error('❌ Error fetching profile:', profileError.message);
                continue;
            }

            if (!profile) {
                console.log('❌ No profile found - cannot fix this user');
                continue;
            }

            console.log(`✅ Found profile with ID: ${profile.id}`);
            console.log(`   Credits: ${profile.credits_remaining}`);

            // 2. Check if auth user exists
            const { data: authUsers } = await local.auth.admin.listUsers();
            const existingAuth = authUsers.users.find(u => u.email?.toLowerCase() === user.email.toLowerCase());

            if (existingAuth) {
                console.log(`✅ Auth account already exists: ${existingAuth.id}`);

                // Check if IDs match
                if (existingAuth.id !== profile.id) {
                    console.log(`⚠️  WARNING: Auth ID (${existingAuth.id}) doesn't match Profile ID (${profile.id})`);
                    console.log(`   This needs manual database intervention.`);
                }
                continue;
            }

            // 3. Create auth user with the SAME ID as the profile
            console.log(`🔨 Creating auth account with ID: ${profile.id}`);

            const { data: newAuthUser, error: authError } = await local.auth.admin.createUser({
                id: profile.id, // Use the existing profile ID
                email: user.email,
                password: 'Applywizz@123',
                email_confirm: true,
                user_metadata: {
                    name: user.name
                }
            });

            if (authError) {
                console.error('❌ Failed to create auth user:', authError.message);
                continue;
            }

            console.log(`✅ Auth account created successfully!`);
            console.log(`   User ID: ${newAuthUser.user?.id}`);
            console.log(`   Email: ${newAuthUser.user?.email}`);
            console.log(`   Password: Applywizz@123`);

            // 4. Update the profile to ensure it's linked
            const { error: updateError } = await local
                .from('profiles')
                .update({
                    email: user.email,
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id);

            if (updateError) {
                console.warn('⚠️  Warning: Failed to update profile:', updateError.message);
            }

            // 5. Create CRM tracking record
            const { error: crmError } = await local
                .from('digital_resume_by_crm')
                .insert({
                    email: user.email,
                    user_id: profile.id,
                    credits_remaining: profile.credits_remaining || 4,
                    payment_details: {
                        source: 'MANUAL_FIX',
                        fixed_at: new Date().toISOString(),
                        reason: 'Profile existed but auth account was missing'
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

            // 6. Create dashboard stats
            const { error: statsError } = await local
                .from('crm_dashboard_stats')
                .insert({
                    email: user.email,
                    user_id: profile.id,
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
            console.log(`   Credits: ${profile.credits_remaining || 4}`);

        } catch (error: any) {
            console.error(`❌ Error fixing ${user.email}:`, error.message);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🎉 Fix process completed!');
    console.log('='.repeat(60));
}

fixUsers();
