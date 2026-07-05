-- Create prepaid_card_reloads table
CREATE TABLE IF NOT EXISTS public.prepaid_card_reloads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reload_date DATE NOT NULL,
    amount NUMERIC NOT NULL,
    company TEXT NOT NULL,
    payment_status BOOLEAN DEFAULT FALSE,
    payment_date DATE,
    payment_method TEXT,
    notes TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.prepaid_card_reloads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access (consistent with other tables in this app)
DROP POLICY IF EXISTS "Enable all access for all users" ON public.prepaid_card_reloads;
CREATE POLICY "Enable all access for all users" ON public.prepaid_card_reloads
    FOR ALL USING (true) WITH CHECK (true);
