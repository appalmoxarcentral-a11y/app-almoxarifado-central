-- 1. Create function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update RLS policies for subscription_invoices
-- Admin (Customer) can only SELECT and INSERT (when creating new sub)
-- Super Admin (Owner) can UPDATE and DELETE

DROP POLICY IF EXISTS "Users can update invoices of their tenant" ON public.subscription_invoices;
CREATE POLICY "Super admins can update all invoices" ON public.subscription_invoices
    FOR UPDATE USING (public.is_super_admin());

DROP POLICY IF EXISTS "Users can delete invoices of their tenant" ON public.subscription_invoices;
CREATE POLICY "Super admins can delete all invoices" ON public.subscription_invoices
    FOR DELETE USING (public.is_super_admin());

-- 3. Automatic next invoice generation trigger
CREATE OR REPLACE FUNCTION public.handle_next_invoice_generation()
RETURNS TRIGGER AS $$
DECLARE
    v_next_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only trigger when status changes from pending/failed to paid
    IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
        -- Calculate next due date (1 month after current due date)
        v_next_due_date := NEW.due_date + interval '1 month';
        
        -- Check if a pending invoice already exists for this tenant to avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.subscription_invoices 
            WHERE tenant_id = NEW.tenant_id AND status = 'pending'
        ) THEN
            INSERT INTO public.subscription_invoices (tenant_id, amount, status, due_date)
            VALUES (NEW.tenant_id, NEW.amount, 'pending', v_next_due_date);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_generate_next_invoice ON public.subscription_invoices;
CREATE TRIGGER tr_generate_next_invoice
    AFTER UPDATE ON public.subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_next_invoice_generation();

-- 4. Function to check if tenant is blocked (has pending invoices)
-- Except for the legacy tenant
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Legacy tenant is never blocked
    IF p_tenant_id = '00000000-0000-0000-0000-000000000000' THEN
        RETURN FALSE;
    END IF;

    -- Blocked if has any pending invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
