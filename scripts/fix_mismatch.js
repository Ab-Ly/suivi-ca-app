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

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function findAndUpdate() {
    // Search for the article with a partial name
    const { data, error } = await supabase
        .from('articles')
        .select('id, name')
        .ilike('name', '%Xpro Super 15W-40%Tonnelet 20L%');

    if (error) {
        console.error('Error searching:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Found matches:', data);
        const article = data[0];

        // Update it
        const { error: updateError } = await supabase
            .from('articles')
            .update({ current_stock: 6 })
            .eq('id', article.id);

        if (updateError) {
            console.error('Error updating:', updateError);
        } else {
            console.log(`Successfully updated "${article.name}" to stock: 6`);
        }
    } else {
        console.log('No matches found for Xpro Super 15W-40...Tonnelet 20L');
    }
}

findAndUpdate();
