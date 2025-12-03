-- 1. RESET DATABASE (Wipe all sales and history)
TRUNCATE TABLE sales;
TRUNCATE TABLE stock_movements;
UPDATE articles SET current_stock = 0;

-- 2. SEED INITIAL STOCK (Date: 2025-12-01)
DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Temporary table for initial stock data
    CREATE TEMP TABLE initial_stock (name text, qty int);
    
    INSERT INTO initial_stock (name, qty) VALUES
    ('ATF bidon 1L', 34), -- Corrected from ATF 220 12X1
    ('Xpro Ultra 5W-40 5L', 42),
    ('Xpro Hyper 10W-40 1L', 38),
    ('Xpro Hyper 10W-40 5L', 40),
    ('Xpro Extra 20W-50 1L', 119),
    ('Xpro Extra 20W-50 4L', 49),
    ('Xpro Ultim 15W-40 1L', 39),
    ('Xpro Ultim 15W-40 5L', 48),
    ('Xpro Super 15W-40 1L', 120),
    ('Xpro Super 15W-40 5L', 30),
    ('Xpro plus 40 1L', 46),
    ('Xpro plus 40 5L', 32),
    ('Xpro Plus 50 1L', 156),
    ('Xpro Plus 50 5L', 32),
    ('Xpro Regular 50 25L', 4),
    ('Xpro Regular 40 1L', 37),
    ('Xpro Regular 40 5L', 75),
    ('2T 1L', 41),
    ('Xpro Hyper 10W-40 205L', 1004),
    ('Gear Oil GX 80W-90 1L', 56),
    ('Gear Oil GX 80W-90 2L', 46),
    ('Gear Oil GX 80W-90 25L', 6),
    ('Gear OIL GX 85W-140 2L', 58),
    ('Gear OIL GX 85W-140 25L', 4),
    ('Xpro HD 10W 2L', 72),
    ('Xpro Regular 50 2L', 161),
    ('XPRO REGULAR 50 1L', 62),
    ('Xpro Regular 50 5L', 91),
    ('Eau de batterie bidon 1L', 18),
    ('Liquide de refroidissement bidon 1L', 35),
    ('Lave glace bidon 1L', 166),
    ('Xpro Ultra 5W-40 1L', 74),
    ('Brake fluid DOT 4 500 ml', 49), -- Corrected Case
    ('AdBlue BASF en Tonnelet 10L', 93), -- Corrected Name
    ('Xpro Ultra light 5W30 1L', 97),
    ('Xpro Ultra light 5W30 5L', 78),
    ('GRAISSE MULTI-USAGE N°2 180 KG', 1),
    ('Liquide de refroidissement bidon 5L', 103),
    ('Lave glace bidon 5L', 76),
    ('HYDROLIC 68 15W-40 20L', 4),
    ('Xpro Super 15W-40 20L', 6),
    ('Xpro Regular 50 20L', 8),
    ('Xpro Regular 40 20L', 12),
    ('Gear Oil GX 80W-90 20L', 5),
    ('Gear OIL GX 85W-140 20L', 6),
    ('Xpro HD 10W 20L', 7),
    ('Extra essene treat cart 12x300ml', 67), -- Corrected Name
    ('Extra diesel treat cart 12x300ml', 33), -- Corrected Name
    ('Stop fuite bidon 300ml', 48),
    ('Viscosity plus bidon 300ml', 35);

    -- Loop through and update
    FOR rec IN SELECT * FROM initial_stock LOOP
        -- Update Stock
        UPDATE articles 
        SET current_stock = rec.qty 
        WHERE name = rec.name;

        -- Insert Movement History
        INSERT INTO stock_movements (article_id, type, quantity, movement_date)
        SELECT id, 'in', rec.qty, '2025-12-01 08:00:00'
        FROM articles 
        WHERE name = rec.name;
    END LOOP;

    DROP TABLE initial_stock;
END $$;
