-- Drop the old table if it exists (Optional, mostly for clean slate dev)
-- DROP TABLE IF EXISTS public.fuel_deliveries;

-- 1. Create Parent Table: Fuel Receptions (The "Paperwork")
CREATE TABLE IF NOT EXISTS public.fuel_receptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    date DATE NOT NULL,
    invoice_number TEXT,
    bl_number TEXT,
    total_quantity_billed NUMERIC NOT NULL,     -- The global quantity on the BL
    total_quantity_observed NUMERIC NOT NULL,   -- Sum of all dispatched quantities
    global_difference NUMERIC NOT NULL,         -- (Observed - Billed)
    observations TEXT
);

-- 2. Create Child Table: Reception Items (The "Dispatch")
CREATE TABLE IF NOT EXISTS public.fuel_reception_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reception_id UUID NOT NULL REFERENCES public.fuel_receptions(id) ON DELETE CASCADE,
    tank_id INTEGER NOT NULL,
    tank_name TEXT NOT NULL,
    product_type TEXT NOT NULL,
    level_before NUMERIC NOT NULL,
    level_after NUMERIC NOT NULL,
    quantity_observed NUMERIC NOT NULL          -- (After - Before) for this specific tank
);

-- 3. Enable RLS
ALTER TABLE public.fuel_receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_reception_items ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Open Access for this version)
CREATE POLICY "Enable all access for receptions" ON public.fuel_receptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for items" ON public.fuel_reception_items FOR ALL USING (true) WITH CHECK (true);
