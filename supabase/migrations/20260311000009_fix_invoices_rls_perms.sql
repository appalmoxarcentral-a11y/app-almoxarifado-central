-- Fix RLS policies for subscription_invoices to allow UPDATE and DELETE
-- Currently only SELECT and INSERT are allowed, blocking status updates and deletions

DROP POLICY IF EXISTS "Users can update invoices of their tenant" ON public.subscription_invoices;
CREATE POLICY "Users can update invoices of their tenant" ON public.subscription_invoices
    FOR UPDATE USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Users can delete invoices of their tenant" ON public.subscription_invoices;
CREATE POLICY "Users can delete invoices of their tenant" ON public.subscription_invoices
    FOR DELETE USING (tenant_id = public.get_current_tenant_id());
