-- Update block check function to correctly handle transitions in both directions
-- 1. Automatically transition 'waiting' to 'pending' if overdue (after 1 day grace)
-- 2. Automatically transition 'pending' back to 'waiting' if date is adjusted back to within grace period
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Transition 'waiting' -> 'pending' if current date is strictly AFTER (Vencimento Atual + 1 day)
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND timezone('utc'::text, now()) > (created_at + interval '1 day');

    -- Transition 'pending' -> 'waiting' if current date is WITHIN the grace period
    -- This handles cases where dates are manually corrected/updated in the DB
    UPDATE public.subscription_invoices
    SET status = 'waiting'
    WHERE tenant_id = p_tenant_id 
      AND status = 'pending' 
      AND timezone('utc'::text, now()) <= (created_at + interval '1 day');

    -- Blocked ONLY if has any 'pending' invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
