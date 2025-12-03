import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, '../articles_cleaned.csv');
const outputPath = path.join(__dirname, '../supabase/seed.sql');

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.split('\n').filter(line => line.trim() !== '');


// ref,name,unit,pu,stock_qty,stock_val

const sqlStatements = [];
sqlStatements.push(`-- Seed data from articles_cleaned.csv`);
sqlStatements.push(`INSERT INTO public.articles (name, type, category, price, current_stock) VALUES`);

const values = [];

for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Handle potential commas in quotes if necessary, but this CSV looks simple
    const cols = line.split(',');

    if (cols.length < 6) continue;

    const name = cols[1].trim().replace(/'/g, "''"); // Escape single quotes
    const pu = parseFloat(cols[3].trim()) || 0;
    const stock_qty = parseInt(cols[4].trim()) || 0;

    // Determine category
    let category = 'lubricant_piste';
    const lowerName = name.toLowerCase();

    if (lowerName.includes('lave glace') ||
        lowerName.includes('eau de batterie') ||
        lowerName.includes('liquide de refroidissement') ||
        lowerName.includes('brake fluid') ||
        lowerName.includes('adblue') ||
        lowerName.includes('stop fuite') ||
        lowerName.includes('viscosity') ||
        lowerName.includes('graisse')) {
        category = 'shop'; // Assuming these are shop items despite user saying shop is non-stockable
    }

    values.push(`('${name}', 'stockable', '${category}', ${pu}, ${stock_qty})`);
}

sqlStatements.push(values.join(',\n') + ';');

fs.writeFileSync(outputPath, sqlStatements.join('\n'));

console.log(`Generated SQL seed file at ${outputPath} with ${values.length} articles.`);
