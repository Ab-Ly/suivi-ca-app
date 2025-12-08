
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zzllzyijkwrihxxqucve.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6bGx6eWlqa3dyaWh4eHF1Y3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MTA1MzYsImV4cCI6MjA4MDI4NjUzNn0.1cNKh6Bss4fU5RSiw0WPFA0tgasbw3L5F7RFPU_SSJQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking table money_countings...");

    // 1. Check access / existence
    const { count, error: countError } = await supabase
        .from('money_countings')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error("SELECT Error:", countError);
    } else {
        console.log("Count result:", count);
    }

    // 2. Try Insert
    console.log("Attempting Insert...");
    const { data, error: insertError } = await supabase
        .from('money_countings')
        .insert([{
            date: new Date().toISOString().split('T')[0],
            counts: { "test": "1" },
            total_calc: 10,
            expected_amount: 10,
            gap: 0,
            notes: 'Test script insert'
        }])
        .select();

    if (insertError) {
        console.error("INSERT Error:", insertError);
    } else {
        console.log("Insert Success:", data);
        // Clean up
        const { error: delError } = await supabase.from('money_countings').delete().eq('id', data[0].id);
        if (delError) console.error("Cleanup Error:", delError);
        else console.log("Cleanup Success.");
    }
}

check();
