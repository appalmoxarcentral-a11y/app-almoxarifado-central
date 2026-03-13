-- Update block check function to block access if NO invoices exist
-- A tenant is now blocked if:
-- 1. Has any 'pending' invoice OR
-- 2. Has NO invoices at all (newly registered user who hasn't chosen a plan)
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_invoices BOOLEAN;
BEGIN
    -- 1. Sync status logic (waiting <-> pending)
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND CURRENT_DATE > created_at::date;

    UPDATE public.subscription_invoices
    SET status = 'waiting'
    WHERE tenant_id = p_tenant_id 
      AND status = 'pending' 
      AND CURRENT_DATE <= created_at::date;

    -- 2. Check if tenant has any invoice at all
    SELECT EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id
    ) INTO v_has_invoices;

    -- 3. Block logic:
    -- If no invoices -> BLOCKED
    -- If has pending invoices -> BLOCKED
    -- Otherwise -> UNBLOCKED
    RETURN (NOT v_has_invoices) OR EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
