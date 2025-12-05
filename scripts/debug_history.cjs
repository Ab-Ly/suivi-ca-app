
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHistory() {
    console.log('Fetching historical sales for 2025...');
    const { data, error } = await supabase
        .from('historical_sales')
        .select('*')
        .eq('year', 2025);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} entries.`);

    // Filter for potential fuel entries
    const fuelEntries = data.filter(item =>
        (item.category && item.category.toLowerCase().includes('gasoil')) ||
        (item.category && item.category.toLowerCase().includes('ssp')) ||
        (item.category && item.category.toLowerCase().includes('volume'))
    );

    console.log('\n--- Fuel Related Entries ---');
    if (fuelEntries.length === 0) {
        console.log('No entries matched "gasoil", "ssp", or "volume".');

        console.log('\n--- All Categories Present ---');
        const cats = [...new Set(data.map(d => d.category))];
        console.log(cats);
    } else {
        console.table(fuelEntries.map(e => ({
            month: e.month,
            category: e.category,
            amount: e.amount,
            type: typeof e.amount
        })));
    }
}

checkHistory();
