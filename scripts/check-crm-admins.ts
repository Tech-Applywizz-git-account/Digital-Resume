
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTableSafely() {
    console.log('🚀 Ensuring crm_admins table exists...');

    try {
        // We try to use a simple query. If it fails with 42P01 (relation does not exist), 
        // we can't create it via REST API. We must use an RPC or SQL Editor.
        const { error } = await supabase.from('crm_admins').select('*').limit(1);

        if (error && error.code === '42P01') {
            console.log('⚠️ Table "crm_admins" does not exist.');
            console.log('👉 Please RUN the following SQL in your Supabase SQL Editor:');
            console.log(`
        CREATE TABLE public.crm_admins (
            email TEXT PRIMARY KEY,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            added_by TEXT
        );
        ALTER TABLE public.crm_admins ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow all access to crm_admins" ON public.crm_admins FOR ALL USING (true);
        INSERT INTO public.crm_admins (email) VALUES ('dinesh@applywizz.com') ON CONFLICT DO NOTHING;
      `);
        } else if (error) {
            console.error('❌ Database error:', error.message);
        } else {
            console.log('✅ crm_admins table is ready.');
            // Ensure Dinesh is there
            await supabase.from('crm_admins').upsert({ email: 'dinesh@applywizz.com' });
            console.log('✅ Dinesh@applywizz.com is registered as admin.');
        }
    } catch (err: any) {
        console.error('❌ Unexpected error:', err.message);
    }
}

createTableSafely();
