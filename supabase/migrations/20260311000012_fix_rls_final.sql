-- 1. Enable RLS for plans and allow all authenticated users to view them
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans" ON public.plans
    FOR SELECT TO authenticated USING (true);

-- 2. Fix subscription_invoices INSERT policy for regular users
-- The previous migration might have removed the INSERT policy for non-super-admins
DROP POLICY IF EXISTS "Users can create invoices for their tenant" ON public.subscription_invoices;
CREATE POLICY "Users can create invoices for their tenant" ON public.subscription_invoices
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id()
    );

-- 3. Also ensure users can UPDATE their own invoices (e.g., to save pix_code)
-- This was restricted to super_admin only in migration 000010
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.subscription_invoices;
CREATE POLICY "Users can update their own invoices" ON public.subscription_invoices
    FOR UPDATE
    TO authenticated
    USING (
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id()
    )
    WITH CHECK (
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id()
    );

-- 4. Ensure SELECT policy for subscription_invoices is correct for all
DROP POLICY IF EXISTS "Tenant Isolation" ON public.subscription_invoices;
CREATE POLICY "Tenant Isolation" ON public.subscription_invoices
    FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id()
    );
