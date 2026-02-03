
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

async function setupAdmin() {
    console.log(`🚀 Setting up admin user Dinesh@applywizz.com...`);

    try {
        // 1. Check if user exists
        const { data: users, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users.users.find(u => u.email?.toLowerCase() === 'dinesh@applywizz.com');

        if (existingUser) {
            console.log(`ℹ️ User exists. Resetting password to 'Dinesh@123'...`);
            const { error: updateError } = await supabase.auth.admin.updateUserById(
                existingUser.id,
                {
                    password: 'Dinesh@123',
                    email_confirm: true
                }
            );
            if (updateError) throw updateError;
            console.log(`✅ Password reset successfully.`);
        } else {
            console.log(`ℹ️ User not found. Creating new admin user...`);
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: 'Dinesh@applywizz.com',
                password: 'Dinesh@123',
                email_confirm: true,
                user_metadata: { full_name: 'Dinesh Admin' }
            });
            if (authError) throw authError;
            console.log(`✅ Admin user created: ${authData.user.id}`);

            // Create Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    email: 'Dinesh@applywizz.com',
                    credits_remaining: 100,
                    full_name: 'Dinesh Admin',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (profileError) console.error(`⚠️ Profile error:`, profileError.message);
        }

    } catch (err: any) {
        console.error(`❌ Error during setup:`, err.message);
    }

    console.log('\n✨ Admin setup completed!');
}

setupAdmin();
