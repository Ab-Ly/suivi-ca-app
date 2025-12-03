-- 1. Add sales_location column to sales table
-- This column will store 'piste' or 'bosch' for lubricant sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sales_location TEXT;

-- 2. Update all existing articles to 'Lubrifiants'
-- As requested, all current stock items are lubricants
UPDATE articles SET category = 'Lubrifiants';

-- 3. Insert New Service Articles
-- These are non-stockable services with variable prices (initially 0, set at sale time)
INSERT INTO articles (name, category, type, price, current_stock)
VALUES 
('Shop', 'Service', 'service', 0, 0),
('Café', 'Service', 'service', 0, 0),
('Main d''oeuvre', 'Service', 'service', 0, 0),
('Bosch Car Service', 'Service', 'service', 0, 0);

-- 4. Verify the changes
SELECT * FROM articles WHERE type = 'service';
