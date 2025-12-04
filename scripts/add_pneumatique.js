
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPneumatique() {
    console.log('Adding Service Pneumatique...');

    // Inspect existing article to see columns
    const { data: sample, error: sampleError } = await supabase.from('articles').select('id, name, category').limit(1).single();
    if (sampleError) console.error('Sample error:', sampleError);
    console.log('Sample article:', sample);

    const article = {
        name: 'Service Pneumatique',
        category: 'Pneumatique',
        type: 'service',
        price: 0,
        current_stock: 0
        // min_stock: 0, // Removed potentially invalid column
        // unit: 'unité' // Removed potentially invalid column
    };

    // Check if it already exists
    const { data: existing, error: searchError } = await supabase
        .from('articles')
        .select('*')
        .eq('name', article.name)
        .single();

    if (existing) {
        console.log('Article already exists:', existing);
        return;
    }

    const { data, error } = await supabase
        .from('articles')
        .insert(article)
        .select();

    if (error) {
        console.error('Error inserting article:', error);
    } else {
        console.log('Successfully added article:', data);
    }
}

addPneumatique();
