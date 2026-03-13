-- Refined block check function with day-level precision
-- 1. Automatically transition 'waiting' -> 'pending' if current_date > (Vencimento Atual + 1 day)
-- 2. Automatically transition 'pending' -> 'waiting' if current_date <= (Vencimento Atual + 1 day)
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Transition 'waiting' -> 'pending' 
    -- ONLY IF today is strictly AFTER (Vencimento Atual + 1 day)
    -- Using ::date to compare only the days, ignoring the exact hour
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND CURRENT_DATE > (created_at::date + interval '1 day');

    -- Transition 'pending' -> 'waiting' 
    -- IF today is WITHIN the grace period (<= Vencimento Atual + 1 day)
    UPDATE public.subscription_invoices
    SET status = 'waiting'
    WHERE tenant_id = p_tenant_id 
      AND status = 'pending' 
      AND CURRENT_DATE <= (created_at::date + interval '1 day');

    -- Blocked ONLY if has any 'pending' invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
