-- Migration: Add is_active column to daily_cash_entities table
ALTER TABLE daily_cash_entities ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
