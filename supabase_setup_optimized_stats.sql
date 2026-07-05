-- Create optimized RPC function to calculate daily and monthly cash statistics in a single pass.
-- This bypasses fetching thousands of rows on the client-side, making the app extremely fast.
CREATE OR REPLACE FUNCTION public.get_daily_cash_stats(
    p_selected_date DATE,
    p_start_of_month DATE,
    p_end_of_month DATE,
    p_year INT
)
RETURNS JSON AS $$
DECLARE
    v_prev_bal NUMERIC;
    v_m_exp_open NUMERIC;
    v_m_exp_close NUMERIC;
    v_exp_open NUMERIC;
    v_exp_close NUMERIC;
    v_entity_balances JSON;
    v_recap JSON;
BEGIN
    -- 1. Previous total balance (prevBal)
    SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0)
    INTO v_prev_bal
    FROM public.daily_cash_operations
    WHERE date < p_selected_date;

    -- 2. Expense opening balance for selection date
    SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0)
    INTO v_exp_open
    FROM public.daily_cash_operations
    WHERE category = 'EXPENSE_FUND' AND date < p_selected_date;

    -- 3. Expense closing balance for selection date
    SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0)
    INTO v_exp_close
    FROM public.daily_cash_operations
    WHERE category = 'EXPENSE_FUND' AND date <= p_selected_date;

    -- 4. Monthly expense opening (before start of month)
    SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0)
    INTO v_m_exp_open
    FROM public.daily_cash_operations
    WHERE category = 'EXPENSE_FUND' AND date < p_start_of_month;

    -- 5. Monthly expense closing (up to end of month)
    SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0)
    INTO v_m_exp_close
    FROM public.daily_cash_operations
    WHERE category = 'EXPENSE_FUND' AND date <= p_end_of_month;

    -- 6. Entity balances (opening and closing in one pass)
    SELECT json_object_agg(entity_id, json_build_object(
        'opening', opening_bal,
        'closing', closing_bal
    ))
    INTO v_entity_balances
    FROM (
        SELECT 
            entity_id,
            COALESCE(SUM(CASE WHEN date < p_selected_date THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0) as opening_bal,
            COALESCE(SUM(CASE WHEN date <= p_selected_date THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0) as closing_bal
        FROM public.daily_cash_operations
        WHERE category = 'ENTITY_TRANSACTION' AND entity_id IS NOT NULL
        GROUP BY entity_id
    ) t;

    -- 7. Annual recap (EXPENSE_FUND OUT operations for the current year)
    SELECT json_agg(t)
    INTO v_recap
    FROM (
        SELECT 
            (EXTRACT(MONTH FROM date) - 1)::INT as month,
            SUM(amount)::NUMERIC as amount
        FROM public.daily_cash_operations
        WHERE category = 'EXPENSE_FUND' AND type = 'OUT' AND EXTRACT(YEAR FROM date) = p_year
        GROUP BY EXTRACT(MONTH FROM date)
    ) t;

    RETURN json_build_object(
        'prev_balance', v_prev_bal,
        'expense_opening_balance', v_exp_open,
        'expense_closing_balance', v_exp_close,
        'month_expense_opening', v_m_exp_open,
        'month_expense_closing', v_m_exp_close,
        'entity_balances', COALESCE(v_entity_balances, '{}'::json),
        'annual_recap', COALESCE(v_recap, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
