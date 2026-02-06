
import { createClient } from '@supabase/supabase-js';

const LOCAL_URL = "https://qzzbvgdcnkmjargleluy.supabase.co";
const LOCAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM";

const searchEmails = ['venkatavasavi99@gmail.com', 'Sushruthapatlolla15@gmail.com'];

async function findAuthUsers() {
    const local = createClient(LOCAL_URL, LOCAL_KEY);

    console.log('Fetching ALL auth users...\n');

    const { data: authData, error } = await local.auth.admin.listUsers();

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log(`Total auth users: ${authData.users.length}\n`);

    for (const searchEmail of searchEmails) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Searching for: ${searchEmail}`);
        console.log('='.repeat(60));

        // Try exact match
        const exactMatch = authData.users.find(u => u.email === searchEmail);
        if (exactMatch) {
            console.log('✅ EXACT MATCH FOUND:');
            console.log('  ID:', exactMatch.id);
            console.log('  Email:', exactMatch.email);
            console.log('  Confirmed:', exactMatch.email_confirmed_at ? 'YES' : 'NO');
            console.log('  Created:', exactMatch.created_at);
            continue;
        }

        // Try case-insensitive match
        const caseInsensitiveMatch = authData.users.find(u =>
            u.email?.toLowerCase() === searchEmail.toLowerCase()
        );
        if (caseInsensitiveMatch) {
            console.log('✅ CASE-INSENSITIVE MATCH FOUND:');
            console.log('  ID:', caseInsensitiveMatch.id);
            console.log('  Email (stored):', caseInsensitiveMatch.email);
            console.log('  Email (searched):', searchEmail);
            console.log('  Confirmed:', caseInsensitiveMatch.email_confirmed_at ? 'YES' : 'NO');
            console.log('  Created:', caseInsensitiveMatch.created_at);
            continue;
        }

        // Try partial match
        const partialMatches = authData.users.filter(u =>
            u.email?.toLowerCase().includes(searchEmail.split('@')[0].toLowerCase())
        );
        if (partialMatches.length > 0) {
            console.log(`⚠️  PARTIAL MATCHES FOUND (${partialMatches.length}):`);
            partialMatches.forEach((match, i) => {
                console.log(`\n  Match ${i + 1}:`);
                console.log('    ID:', match.id);
                console.log('    Email:', match.email);
                console.log('    Confirmed:', match.email_confirmed_at ? 'YES' : 'NO');
            });
            continue;
        }

        console.log('❌ NO MATCH FOUND');
    }
}

findAuthUsers();
