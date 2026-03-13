-- Fix RLS policy for dispensacoes to handle multi-tenancy correctly
-- Similar to what was done for entradas_produtos

-- 1. Ensure RLS policies for regular users to INSERT/SELECT from dispensacoes
-- Drop old policy if exists to re-create properly
DROP POLICY IF EXISTS "Tenant Isolation" ON public.dispensacoes;
CREATE POLICY "Tenant Isolation" ON public.dispensacoes
    FOR ALL
    TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id())
    WITH CHECK (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());
