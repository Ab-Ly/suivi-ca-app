-- Security Fixes 2025-12-07
-- Run this script in the Supabase SQL Editor

-- 1. Enable RLS and Create Policies for Sales
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.sales;

CREATE POLICY "Enable all access for authenticated users" ON public.sales
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 2. Enable RLS and Create Policies for Articles
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.articles;

CREATE POLICY "Enable all access for authenticated users" ON public.articles
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Enable RLS and Create Policies for Stock Movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.stock_movements;

CREATE POLICY "Enable all access for authenticated users" ON public.stock_movements
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Fix Fuel Deliveries Policy (Restrict to authenticated only)
-- We use DO blocks to safely apply changes only if the tables exist

DO $$
BEGIN
    -- Check for fuel_deliveries (V1)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fuel_deliveries') THEN
        ALTER TABLE public.fuel_deliveries ENABLE ROW LEVEL SECURITY;
        
        -- Drop potentially permissive policies
        DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.fuel_deliveries;
        DROP POLICY IF EXISTS "Enable all access" ON public.fuel_deliveries;
        
        -- Create strict authenticated policy
        CREATE POLICY "Enable all access for authenticated users" ON public.fuel_deliveries
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;

    -- Check for fuel_receptions (V2)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fuel_receptions') THEN
        ALTER TABLE public.fuel_receptions ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Enable all access for receptions" ON public.fuel_receptions;
        
        CREATE POLICY "Enable all access for authenticated users" ON public.fuel_receptions
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;

    -- Check for fuel_reception_items (V2)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fuel_reception_items') THEN
        ALTER TABLE public.fuel_reception_items ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Enable all access for items" ON public.fuel_reception_items;
        
        CREATE POLICY "Enable all access for authenticated users" ON public.fuel_reception_items
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
