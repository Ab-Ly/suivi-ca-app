-- Fix categories for service items to match Dashboard logic
-- The Dashboard expects specific categories to group sales correctly

UPDATE articles SET category = 'Shop' WHERE name = 'Shop';
UPDATE articles SET category = 'Café' WHERE name = 'Café';
UPDATE articles SET category = 'Bosch Service' WHERE name = 'Bosch Car Service';
UPDATE articles SET category = 'Bosch Service' WHERE name = 'Main d''oeuvre';

-- Verify the updates
SELECT name, category FROM articles WHERE type = 'service';
