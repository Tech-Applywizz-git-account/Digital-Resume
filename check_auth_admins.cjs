
const { createClient } = require('@supabase/supabase-js');
dotenv = require('dotenv');
dotenv.config();

const client = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAuthUsers() {
    const { data: { users }, error } = await client.auth.admin.listUsers();
    if (error) {
        console.log('Error listing users:', error.message);
        return;
    }

    const emails = ['dinesh@applywizz.com', 'balaji@applywizz.com'];
    const found = users.filter(u => emails.includes(u.email));

    console.log('Found Auth Users:', found.map(u => u.email));
}
checkAuthUsers();
