import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file manually
const envPath = path.resolve(__dirname, '../.env');
let supabaseUrl;
let supabaseKey;

try {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
        const [key, value] = line.split('=');
        if (key && value) {
            if (key.trim() === 'VITE_SUPABASE_URL') supabaseUrl = value.trim();
            if (key.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value.trim();
        }
    }
} catch (e) {
    console.error('Error reading .env file:', e);
    process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('Starting data reset and seed...');

    // 1. Clear existing data
    console.log('Clearing daily_cash_operations...');
    const { error: opError } = await supabase.from('daily_cash_operations').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (opError) console.error('Error clearing operations:', opError);

    console.log('Clearing daily_cash_entities...');
    const { error: entError } = await supabase.from('daily_cash_entities').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (entError) console.error('Error clearing entities:', entError);

    // 2. Insert Entities
    console.log('Inserting entities...');
    const entities = [
        { name: 'STE OTRADI' },
        { name: 'STE STM SCHOOL' },
        { name: 'ASSOCIATION SIRAJ' },
        { name: 'STE RITAGE SEVEN C' }
    ];

    const { data: insertedEntities, error: insEntError } = await supabase
        .from('daily_cash_entities')
        .insert(entities)
        .select();

    if (insEntError) {
        console.error('Error inserting entities:', insEntError);
        return;
    }

    const entityMap = {};
    insertedEntities.forEach(e => entityMap[e.name] = e.id);

    // 3. Insert Operations
    console.log('Inserting operations...');
    const date = '2024-12-03';
    const operations = [
        // Entrées
        {
            date,
            type: 'IN',
            amount: 5000,
            description: 'Reste J-1', // Assuming this is the 5000 value
            category: 'OTHER'
        },
        {
            date,
            type: 'IN',
            amount: 4000,
            description: 'Recette à 8H',
            category: 'OTHER'
        },
        {
            date,
            type: 'IN',
            amount: 300,
            description: 'Autre Entrée',
            category: 'OTHER'
        },
        // Entity Balances (IN)
        {
            date,
            type: 'IN',
            amount: 2100,
            description: 'Solde STE OTRADI',
            category: 'ENTITY_TRANSACTION',
            entity_id: entityMap['STE OTRADI']
        },
        {
            date,
            type: 'IN',
            amount: 2100,
            description: 'Solde STE STM SCHOOL',
            category: 'ENTITY_TRANSACTION',
            entity_id: entityMap['STE STM SCHOOL']
        },
        {
            date,
            type: 'IN',
            amount: 1000,
            description: 'Solde ASSOCIATION SIRAJ',
            category: 'ENTITY_TRANSACTION',
            entity_id: entityMap['ASSOCIATION SIRAJ']
        },
        {
            date,
            type: 'IN',
            amount: 2100,
            description: 'Solde STE RITAGE SEVEN C',
            category: 'ENTITY_TRANSACTION',
            entity_id: entityMap['STE RITAGE SEVEN C']
        },
        // Sorties
        {
            date,
            type: 'OUT',
            amount: 15000,
            description: 'Comptage Matin',
            category: 'OTHER'
        },
        {
            date,
            type: 'OUT',
            amount: 500,
            description: 'Caisse Dépense',
            category: 'EXPENSE_FUND' // Using EXPENSE_FUND to match logic if needed, or OTHER
        },
        {
            date,
            type: 'OUT',
            amount: 800,
            description: 'Autre Sortie',
            category: 'OTHER'
        }
    ];

    const { error: insOpError } = await supabase
        .from('daily_cash_operations')
        .insert(operations);

    if (insOpError) {
        console.error('Error inserting operations:', insOpError);
    } else {
        console.log('Operations inserted successfully.');
    }

    console.log('Done.');
}

seed();
