-- Add status column to daily_cash_operations table to track settlement
-- Values: 'PENDING' (Default), 'PAID', 'REIMBURSED'

ALTER TABLE daily_cash_operations 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'PENDING';

-- Optional: Index for faster filtering if needed in future
-- CREATE INDEX idx_daily_cash_operations_status ON daily_cash_operations(status);
