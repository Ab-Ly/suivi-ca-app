-- Create fuel_deliveries table
CREATE TABLE IF NOT EXISTS public.fuel_deliveries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    date DATE NOT NULL,
    invoice_number TEXT,
    bl_number TEXT,
    tank_id INTEGER NOT NULL,
    tank_name TEXT NOT NULL,
    product_type TEXT NOT NULL,
    quantity_billed NUMERIC NOT NULL,
    level_before NUMERIC NOT NULL,
    level_after NUMERIC NOT NULL,
    quantity_observed NUMERIC, -- Calculated as level_after - level_before
    difference NUMERIC, -- Calculated as quantity_observed - quantity_billed
    observations TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.fuel_deliveries ENABLE ROW LEVEL SECURITY;

-- Create Policy to allow all access (since this is a single-tenant internal app)
-- Modify this if you need stricter permissions
CREATE POLICY "Enable all access for authenticated users" ON public.fuel_deliveries
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'anon')
    WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'anon');
