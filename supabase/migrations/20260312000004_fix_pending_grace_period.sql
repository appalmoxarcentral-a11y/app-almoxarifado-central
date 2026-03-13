-- Update block check function to consider late only the day AFTER due date
-- An invoice becomes 'pending' only when current_date > Vencimento Atual (created_at)
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Automatically update any 'waiting' invoice to 'pending' 
    -- ONLY IF the current date is strictly AFTER the 'Vencimento Atual' (created_at)
    -- This means on the exact day of due date, it is still NOT considered late.
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND timezone('utc'::text, now()) > (created_at + interval '1 day');

    -- Blocked ONLY if has any 'pending' invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
