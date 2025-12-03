import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
const csvPath = path.join(__dirname, '../articles_cleaned.csv');

// Manually parse .env
let VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
let VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            if (key.trim() === 'VITE_SUPABASE_URL') VITE_SUPABASE_URL = value.trim();
            if (key.trim() === 'VITE_SUPABASE_ANON_KEY') VITE_SUPABASE_ANON_KEY = value.trim();
        }
    });
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function verifyStock() {
    console.log('Verifying stock consistency...');

    // 1. Read CSV
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    const expectedStock = {};

    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 5) continue;

        const name = cols[1].trim();
        const qty = parseInt(cols[4].trim()) || 0;
        expectedStock[name] = qty;
    }

    // 2. Fetch from Supabase
    const { data: dbArticles, error } = await supabase
        .from('articles')
        .select('name, current_stock');

    if (error) {
        console.error('Error fetching from DB:', error.message);
        return;
    }

    // 3. Compare
    let errors = 0;
    const dbMap = {};
    dbArticles.forEach(a => dbMap[a.name] = a.current_stock);

    console.log('\n--- Discrepancies ---');

    // Check missing in DB or wrong quantity
    for (const [name, expectedQty] of Object.entries(expectedStock)) {
        // Handle the special character case for "Xpro Super 15W-40"
        // The CSV might have "Xpro Super 15W-40Â Â Tonnelet 20L" (utf8) or similar
        // We'll try exact match first

        let dbQty = dbMap[name];

        // If not found, try to find a close match in DB (handling the encoding issue we saw earlier)
        if (dbQty === undefined) {
            const potentialMatch = dbArticles.find(a => a.name.includes(name.substring(0, 15)) && a.name.includes('20L'));
            if (potentialMatch) {
                dbQty = potentialMatch.current_stock;
                // console.log(`(Fuzzy matched "${name}" to "${potentialMatch.name}")`);
            }
        }

        if (dbQty === undefined) {
            console.error(`[MISSING] "${name}" is not in the database.`);
            errors++;
        } else if (dbQty !== expectedQty) {
            console.error(`[MISMATCH] "${name}": CSV=${expectedQty}, DB=${dbQty}`);
            errors++;
        }
    }

    console.log('\n--- Summary ---');
    console.log(`Checked ${Object.keys(expectedStock).length} articles.`);
    if (errors === 0) {
        console.log('✅ All stock quantities match!');
    } else {
        console.log(`❌ Found ${errors} discrepancies.`);
    }
}

verifyStock();
