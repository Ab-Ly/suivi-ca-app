
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env parser
function parseEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            env[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
    return env;
}

const env = parseEnv('.env');
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
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

    console.log(`Found ${data.length} entries for 2025.`);

    console.log('\n--- First 5 Entries ---');
    console.table(data.slice(0, 5).map(e => ({
        month: e.month,
        category: e.category,
        amount: e.amount
    })));

    // Filter for potential fuel entries
    const fuelEntries = data.filter(item => {
        const cat = (item.category || '').toLowerCase();
        return cat.includes('gasoil') || cat.includes('ssp') || cat.includes('sans plomb') || cat.includes('volume');
    });

    console.log('\n--- Fuel Related Entries (Gasoil/SSP/Volume) ---');
    if (fuelEntries.length === 0) {
        console.log('No entries matched "gasoil", "ssp", "sans plomb" or "volume".');
        console.log('Full category list:', [...new Set(data.map(d => d.category))]);
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
