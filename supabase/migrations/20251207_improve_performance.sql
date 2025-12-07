-- Performance Improvements 2025-12-07
-- Run this script in the Supabase SQL Editor

-- 1. Add Index to Sales -> Articles Foreign Key
CREATE INDEX IF NOT EXISTS idx_sales_article_id ON public.sales(article_id);

-- 2. Add Index to Stock Movements -> Articles Foreign Key
CREATE INDEX IF NOT EXISTS idx_stock_movements_article_id ON public.stock_movements(article_id);

-- 3. Add Index to Fuel Reception Items -> Reception Foreign Key (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fuel_reception_items') THEN
        CREATE INDEX IF NOT EXISTS idx_fuel_reception_items_reception_id ON public.fuel_reception_items(reception_id);
    END IF;
END $$;

-- 4. Add Index to Fuel Deliveries Tank ID (optional but good for filtering)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fuel_deliveries') THEN
        CREATE INDEX IF NOT EXISTS idx_fuel_deliveries_tank_id ON public.fuel_deliveries(tank_id);
    END IF;
END $$;
