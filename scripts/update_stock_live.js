import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');

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

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    console.error('Error: Supabase credentials not found in .env or environment variables.');
    process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

const updates = [
    { name: 'GearOil GX 80W-90 Tonnelet 20L', stock: 5 },
    { name: 'GearOil GX 85W-140 Tonnelet 20L', stock: 6 },
    { name: 'Hydraulic 68 Tonnelet 20L', stock: 4 },
    { name: 'Stop fuite cart 12x300ml', stock: 48 },
    { name: 'Viscosity plus cart 12x300m', stock: 35 },
    { name: 'Xpro HD 10W Tonnelet 20L', stock: 7 },
    { name: 'Xpro Regular 40 Tonnelet 20L', stock: 12 },
    { name: 'Xpro Regular 50 1L', stock: 91 },
    { name: 'Xpro Regular 50 Tonnelet 20L', stock: 8 },
    { name: 'Xpro Super 15W-40Â Â Tonnelet 20L', stock: 6 },
    { name: 'Xpro Ultra Light 5W-30 1L', stock: 97 },
    { name: 'Xpro Ultra Light 5W-30 5L', stock: 78 }
];

async function updateStock() {
    console.log('Updating stock quantities...');

    for (const item of updates) {
        const { data, error } = await supabase
            .from('articles')
            .update({ current_stock: item.stock })
            .eq('name', item.name)
            .select();

        if (error) {
            console.error(`Error updating ${item.name}:`, error.message);
        } else if (data.length === 0) {
            console.warn(`Warning: Article "${item.name}" not found.`);
        } else {
            console.log(`Updated "${item.name}" to stock: ${item.stock}`);
        }
    }
}

updateStock();
