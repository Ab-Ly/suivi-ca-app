-- Create table for operating expenses (OPEX)
CREATE TABLE IF NOT EXISTS public.operating_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('Loyer', 'Electricite', 'Eau', 'Salaires', 'Taxes', 'Assurances', 'Entretien', 'Fournitures', 'Autre')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('VIREMENT', 'PRELEVEMENT', 'ESPECES', 'CHEQUE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Enable all access for authenticated users on operating_expenses" ON public.operating_expenses;

-- Create policy for open access in this version
CREATE POLICY "Enable all access for authenticated users on operating_expenses" ON public.operating_expenses
    FOR ALL USING (true) WITH CHECK (true);
