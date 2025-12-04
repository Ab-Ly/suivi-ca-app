-- Create table for historical sales data
CREATE TABLE IF NOT EXISTS historical_sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL,
    category TEXT NOT NULL,
    amount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(month, year, category)
);

-- Enable Row Level Security (RLS)
ALTER TABLE historical_sales ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming public access for simplicity based on current app structure, or authenticated)
-- Adjust based on your actual auth setup. Here allowing all for simplicity as per existing patterns if any.
CREATE POLICY "Enable read access for all users" ON historical_sales FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON historical_sales FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON historical_sales FOR UPDATE USING (true);
