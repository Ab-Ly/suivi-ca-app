CREATE TABLE IF NOT EXISTS fuel_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_date DATE NOT NULL,
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('Gasoil', 'SSP')),
    quantity_liters DECIMAL(12, 3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE fuel_sales ENABLE ROW LEVEL SECURITY;

-- Create policy for access
CREATE POLICY "Enable all access for authenticated users" ON fuel_sales
    FOR ALL USING (true) WITH CHECK (true);
