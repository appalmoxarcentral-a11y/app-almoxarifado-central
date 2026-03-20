
-- 1. Remove existing functions to recreate with new structure
DROP FUNCTION IF EXISTS public.get_all_tenants_admin();
DROP FUNCTION IF EXISTS public.handle_next_invoice_generation();

-- 2. Fixed function with explicit aliases to avoid ambiguous column errors
-- And ensures status is consistent for the dashboard
CREATE OR REPLACE FUNCTION public.get_all_tenants_admin()
RETURNS TABLE (
    id UUID,
    name TEXT,
    document TEXT,
    plan_name TEXT,
    plan_price NUMERIC,
    status TEXT,
    period_end TIMESTAMP WITH TIME ZONE,
    last_payment_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_subs AS (
        SELECT DISTINCT ON (sub.tenant_id) 
            sub.tenant_id, 
            sub.plan_id, 
            sub.status as sub_status, 
            sub.current_period_end
        FROM public.subscriptions sub
        ORDER BY sub.tenant_id, sub.created_at DESC
    ),
    latest_invoices AS (
        SELECT DISTINCT ON (inv.tenant_id) 
            inv.tenant_id, 
            inv.status as inv_status, 
            inv.due_date
        FROM public.subscription_invoices inv
        ORDER BY inv.tenant_id, inv.created_at DESC
    )
    SELECT 
        t.id,
        t.name,
        t.document,
        p.name as plan_name,
        p.price as plan_price,
        COALESCE(i.inv_status, s.sub_status) as status,
        COALESCE(i.due_date, s.current_period_end) as period_end,
        (SELECT inv2.payment_date 
         FROM public.subscription_invoices inv2 
         WHERE inv2.tenant_id = t.id AND inv2.status = 'paid' 
         ORDER BY inv2.payment_date DESC LIMIT 1) as last_payment_date
    FROM public.tenants t
    LEFT JOIN latest_subs s ON s.tenant_id = t.id
    LEFT JOIN public.plans p ON p.id = s.plan_id
    LEFT JOIN latest_invoices i ON i.tenant_id = t.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Automatic next invoice generation trigger - NOW USES 'waiting'
CREATE OR REPLACE FUNCTION public.handle_next_invoice_generation()
RETURNS TRIGGER AS $$
DECLARE
    v_next_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only trigger when status changes from pending/failed/waiting to paid
    IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
        -- Calculate next due date (1 month after current due date)
        v_next_due_date := NEW.due_date + interval '1 month';
        
        -- Check if a waiting/pending invoice already exists for this tenant to avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.subscription_invoices 
            WHERE tenant_id = NEW.tenant_id AND status IN ('pending', 'waiting')
        ) THEN
            INSERT INTO public.subscription_invoices (tenant_id, amount, status, due_date)
            VALUES (NEW.tenant_id, NEW.amount, 'waiting', v_next_due_date);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS tr_generate_next_invoice ON public.subscription_invoices;
CREATE TRIGGER tr_generate_next_invoice
    AFTER UPDATE ON public.subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_next_invoice_generation();

-- 4. Update existing invoices that are 'pending' but NOT due yet to 'waiting'
-- This fixes the immediate blocking issue for SMSA and others
UPDATE public.subscription_invoices 
SET status = 'waiting' 
WHERE status = 'pending' AND due_date > now();

-- 5. Ensure is_tenant_blocked only blocks on 'pending' status
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Block ONLY if has any invoice with status 'pending'
    -- 'waiting' invoices should NOT block.
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
