-- Migration to add UPDATE policy for subscriptions table
-- This allows users to update their own tenant's subscription (e.g., when choosing a new plan)

DROP POLICY IF EXISTS "Users can update their own tenant subscription" ON public.subscriptions;
CREATE POLICY "Users can update their own tenant subscription" ON public.subscriptions
    FOR UPDATE USING (tenant_id = public.get_current_tenant_id())
    WITH CHECK (tenant_id = public.get_current_tenant_id());

-- Ensure super admins can also update all subscriptions
DROP POLICY IF EXISTS "Super admins can update all subscriptions" ON public.subscriptions;
CREATE POLICY "Super admins can update all subscriptions" ON public.subscriptions
    FOR ALL USING (public.is_super_admin());
