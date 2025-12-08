-- Create table for tracking money counting history
CREATE TABLE IF NOT EXISTS money_countings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_calc DECIMAL(12, 3) NOT NULL,
    expected_amount DECIMAL(12, 3) NOT NULL,
    gap DECIMAL(12, 3) NOT NULL,
    
    -- Optional: Link to a user or session if needed later
    -- user_id UUID REFERENCES auth.users(id),

    -- Additional metadata could go here
    notes TEXT
);

-- Index for querying by date
CREATE INDEX idx_money_countings_date ON money_countings(date);

-- Enable RLS
ALTER TABLE money_countings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to do everything (for now, similar to other tables)
CREATE POLICY "Enable all access for authenticated users" ON money_countings
    FOR ALL USING (true) WITH CHECK (true);
