-- Drop the category check constraint on operating_expenses table to allow new categories like 'Interim', 'Securite', etc.
ALTER TABLE public.operating_expenses DROP CONSTRAINT IF EXISTS operating_expenses_category_check;
