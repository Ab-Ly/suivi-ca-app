-- Indexes for Daily Cash operations
CREATE INDEX IF NOT EXISTS idx_daily_cash_operations_date ON public.daily_cash_operations(date);
CREATE INDEX IF NOT EXISTS idx_daily_cash_operations_entity ON public.daily_cash_operations(entity_id);

-- Indexes for Operating Expenses
CREATE INDEX IF NOT EXISTS idx_operating_expenses_date ON public.operating_expenses(date);
CREATE INDEX IF NOT EXISTS idx_operating_expenses_category ON public.operating_expenses(category);

-- Indexes for Fuel Prices
CREATE INDEX IF NOT EXISTS idx_fuel_prices_date ON public.fuel_prices(date);
