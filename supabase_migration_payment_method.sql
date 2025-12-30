-- Add payment_method column to daily_cash_operations table
-- This column will store values like 'ESPECES', 'CHEQUE', 'VIREMENT', 'CARTE_BANCAIRE'

ALTER TABLE daily_cash_operations 
ADD COLUMN IF NOT EXISTS payment_method text;

-- Optional: If you want to set a default for existing records, uncomment the line below
-- UPDATE daily_cash_operations SET payment_method = 'ESPECES' WHERE payment_method IS NULL;
