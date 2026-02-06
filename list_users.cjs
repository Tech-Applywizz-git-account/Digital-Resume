
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://qzzbvgdcnkmjargleluy.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6emJ2Z2RjbmttamFyZ2xlbHV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkwODkyMywiZXhwIjoyMDc3NDg0OTIzfQ.9yLMRrYjGJYr_PvOA7-4FADAQ1qzosn2C-16rCsacfM';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAll() {
    let allUsers = [];
    let page = 1;
    let hasMore = true;

    console.log('Fetching all users (paginated)...');

    while (hasMore) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({
            page: page,
            perPage: 1000
        });

        if (error) {
            console.error('Error:', error);
            break;
        }

        if (users.length === 0) {
            hasMore = false;
        } else {
            allUsers = allUsers.concat(users);
            console.log(`Fetched page ${page}, total so far: ${allUsers.length}`);
            page++;
        }

        // Safety break if there are many users
        if (page > 50) break;
    }

    const fs = require('fs');
    const content = allUsers.map(u => u.email).join('\n');
    fs.writeFileSync('all_users_emails.txt', content);
    console.log(`Saved ${allUsers.length} user emails to all_users_emails.txt`);
}

listAll();
