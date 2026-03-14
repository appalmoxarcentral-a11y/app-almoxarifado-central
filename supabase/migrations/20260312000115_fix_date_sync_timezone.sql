-- Fix date synchronization with proper timezone (America/Sao_Paulo)
-- 1. Create a dedicated sync function that can be called independently
CREATE OR REPLACE FUNCTION public.sync_invoice_status(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Transition 'waiting' -> 'pending' 
    -- ONLY IF today (Brazil) is strictly AFTER the local date of Vencimento Atual (created_at)
    -- Both are compared in America/Sao_Paulo to ensure 100% precision with Brazil time.
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND (timezone('America/Sao_Paulo', now())::date) > (timezone('America/Sao_Paulo', created_at)::date);

    -- Transition 'pending' -> 'waiting' 
    -- IF today (Brazil) is within the grace period (<= local Vencimento Atual)
    UPDATE public.subscription_invoices
    SET status = 'waiting'
    WHERE tenant_id = p_tenant_id 
      AND status = 'pending' 
      AND (timezone('America/Sao_Paulo', now())::date) <= (timezone('America/Sao_Paulo', created_at)::date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update the blocking check function to use the new sync function
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_invoices BOOLEAN;
BEGIN
    -- Sync statuses first
    PERFORM public.sync_invoice_status(p_tenant_id);

    -- Check if tenant has any invoice at all
    SELECT EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id
    ) INTO v_has_invoices;

    -- Block logic:
    -- If no invoices -> BLOCKED
    -- If has any pending invoices -> BLOCKED
    -- Otherwise -> UNBLOCKED
    -- IMPORTANT: We check 'pending' status directly from the table after sync
    RETURN (NOT v_has_invoices) OR EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger to ensure next invoice generation happens and syncs immediately
CREATE OR REPLACE FUNCTION public.on_invoice_update_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync for the tenant whenever something changes
    PERFORM public.sync_invoice_status(NEW.tenant_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists and recreate trigger
DROP TRIGGER IF EXISTS tr_sync_invoices ON public.subscription_invoices;
CREATE TRIGGER tr_sync_invoices
    AFTER INSERT OR UPDATE ON public.subscription_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.on_invoice_update_sync();
