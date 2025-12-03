-- DANGER: This script will delete ALL sales and stock history!
-- Use this only when you want to reset the system completely.

-- 1. Delete all sales records
TRUNCATE TABLE sales;

-- 2. Delete all stock movement history
TRUNCATE TABLE stock_movements;

-- 3. Reset all article stock levels to 0
UPDATE articles SET current_stock = 0;

-- Optional: If you want to keep the categories but clean up any test articles, you could do that here,
-- but usually we want to keep the article definitions.
