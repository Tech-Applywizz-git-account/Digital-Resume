/**
 * Database Configuration
 *
 * Creates and exports a single Supabase admin client using the service_role key.
 * This client has full access to all tables (bypasses RLS).
 * Only the backend holds this key — never exposed to the browser.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from './environment.js';
import { logger } from '../logger/index.js';

let supabaseAdmin: SupabaseClient | null = null;

export function getDatabase(): SupabaseClient {
    if (!supabaseAdmin) {
        logger.info('Initializing Supabase admin client...');
        supabaseAdmin = createClient(
            environment.supabaseUrl,
            environment.supabaseServiceRoleKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                },
                db: {
                    schema: 'public',
                },
            },
        );
        logger.info('Supabase admin client initialized');
    }
    return supabaseAdmin;
}

/**
 * Create an anonymous Supabase client (limited anon key access).
 * Used in contexts where service_role is not appropriate (e.g., auth verification).
 */
let supabaseAnon: SupabaseClient | null = null;

export function getAnonClient(): SupabaseClient {
    if (!supabaseAnon) {
        supabaseAnon = createClient(
            environment.supabaseUrl,
            environment.supabaseAnonKey,
            {
                auth: {
                    persistSession: false,
                },
            },
        );
    }
    return supabaseAnon;
}