-- Create daily_cash_closings table
CREATE TABLE IF NOT EXISTS public.daily_cash_closings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    date DATE NOT NULL UNIQUE,
    recette_8h_j_prev NUMERIC NOT NULL DEFAULT 0,
    recette_8h_j NUMERIC NOT NULL DEFAULT 0,
    total_rendement_j_prev NUMERIC NOT NULL DEFAULT 0,
    total_rendement_piste NUMERIC NOT NULL DEFAULT 0,
    shifts_data JSONB DEFAULT '[]'::jsonb,
    tpe NUMERIC NOT NULL DEFAULT 0,
    petrom_card NUMERIC NOT NULL DEFAULT 0,
    bon_sntl NUMERIC NOT NULL DEFAULT 0,
    bon_ste NUMERIC NOT NULL DEFAULT 0,
    shop_cafe NUMERIC NOT NULL DEFAULT 0,
    sce_bosch NUMERIC NOT NULL DEFAULT 0,
    lubrifiant NUMERIC NOT NULL DEFAULT 0,
    comptage_espece_total NUMERIC NOT NULL DEFAULT 0,
    notes TEXT
);

-- Upgrade existing table if already created
ALTER TABLE public.daily_cash_closings ADD COLUMN IF NOT EXISTS shifts_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.daily_cash_closings ADD COLUMN IF NOT EXISTS total_rendement_piste NUMERIC NOT NULL DEFAULT 0;

-- Enable Row Level Security (RLS)
ALTER TABLE public.daily_cash_closings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access (consistent with other tables in this app)
DROP POLICY IF EXISTS "Enable all access for all users" ON public.daily_cash_closings;
CREATE POLICY "Enable all access for all users" ON public.daily_cash_closings
    FOR ALL USING (true) WITH CHECK (true);
