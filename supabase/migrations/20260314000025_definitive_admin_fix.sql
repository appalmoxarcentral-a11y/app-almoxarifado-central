-- Final and Definitive fix for Admin permissions on Profile management
-- This ensures that users with 'admin' role can manage all profiles within their tenant.

-- 1. Ensure helper functions are robust and use COALESCE
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $func$
DECLARE
    v_role text;
BEGIN
    -- Security Definer bypasses RLS to check the role
    SELECT lower(COALESCE(role, 'user')) INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role IN ('admin', 'super_admin');
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $func$
DECLARE
    v_role text;
BEGIN
    SELECT lower(COALESCE(role, 'user')) INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role = 'super_admin';
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop ALL possible conflicting policies on profiles
DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their unit" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_Update_Team" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to manage team members" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_New" ON public.profiles;

-- 3. Create a clean and powerful MANAGE policy for Admins
-- We use COALESCE on tenant_id to ensure that legacy/null tenants don't block the check
CREATE POLICY "profiles_admin_manage_all_in_tenant" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        id = auth.uid() OR
        (
            public.is_admin() AND 
            COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000') = public.get_current_tenant_id()
        )
    )
    WITH CHECK (
        public.is_super_admin() OR 
        id = auth.uid() OR
        (
            public.is_admin() AND 
            COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000') = public.get_current_tenant_id()
        )
    );

-- 4. Create a clean SELECT policy
CREATE POLICY "profiles_admin_select_all_in_tenant" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin() OR 
        id = auth.uid() OR
        COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000') = public.get_current_tenant_id()
    );

-- 5. Ensure Audit table is also fully accessible to Admins
DROP POLICY IF EXISTS "Admins can manage audit logs" ON public.audit_vinculos_unidade;
CREATE POLICY "Admins can manage audit logs" ON public.audit_vinculos_unidade
    FOR ALL 
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 6. Verify and Fix any NULL tenant_ids just in case
UPDATE public.profiles 
SET tenant_id = '00000000-0000-0000-0000-000000000000' 
WHERE tenant_id IS NULL;

-- 7. Final grant
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.audit_vinculos_unidade TO authenticated;
GRANT ALL ON public.unidades_saude TO authenticated;
