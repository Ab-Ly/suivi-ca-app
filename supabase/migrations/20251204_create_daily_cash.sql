-- Create table for tracking entities (Sociétés)
CREATE TABLE IF NOT EXISTS daily_cash_entities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert initial entities
INSERT INTO daily_cash_entities (name) VALUES
    ('STE OTRADI'),
    ('STE STM SCHOOL'),
    ('STE RITAGE SEVEN C'),
    ('ASSOCIATION SIRAJ')
ON CONFLICT (name) DO NOTHING;

-- Create table for daily cash operations
CREATE TABLE IF NOT EXISTS daily_cash_operations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')), -- IN = Credit (Recette), OUT = Debit (Dépense)
    amount DECIMAL(12, 3) NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('ENTITY_TRANSACTION', 'EXPENSE_FUND', 'OTHER')),
    entity_id UUID REFERENCES daily_cash_entities(id), -- Nullable, only for ENTITY_TRANSACTION
    
    -- Constraint: If category is ENTITY_TRANSACTION, entity_id must be present
    CONSTRAINT check_entity_required CHECK (
        (category = 'ENTITY_TRANSACTION' AND entity_id IS NOT NULL) OR
        (category != 'ENTITY_TRANSACTION')
    )
);

-- Enable RLS but allow all access for now (as per existing pattern likely, or just public)
ALTER TABLE daily_cash_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_cash_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users" ON daily_cash_entities
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for authenticated users" ON daily_cash_operations
    FOR ALL USING (true) WITH CHECK (true);
