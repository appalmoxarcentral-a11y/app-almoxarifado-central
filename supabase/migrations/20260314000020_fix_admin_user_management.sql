-- Fix Admin permissions for user management and unit linking
-- This migration ensures that 'admin' users can move users between units within their tenant.

-- 1. Robust and Case-Insensitive Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $func$
DECLARE
    v_role text;
BEGIN
    SELECT lower(role) INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role IN ('admin', 'super_admin');
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $func$
DECLARE
    v_role text;
BEGIN
    SELECT lower(role) INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role = 'super_admin';
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure Profiles can be managed by Admins of the same tenant
DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;
CREATE POLICY "profiles_manage_policy" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            public.is_admin()
        )
    )
    WITH CHECK (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            public.is_admin()
        )
    );

-- 3. Ensure Audit Logs can be created and viewed by Admins
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_vinculos_unidade;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_vinculos_unidade;
DROP POLICY IF EXISTS "Admins can manage audit logs" ON public.audit_vinculos_unidade;

CREATE POLICY "Admins can manage audit logs" ON public.audit_vinculos_unidade
    FOR ALL 
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Users can view their own audit logs" ON public.audit_vinculos_unidade
    FOR SELECT 
    TO authenticated
    USING (usuario_id = auth.uid());

-- 4. Ensure Units are visible to all authenticated users
DROP POLICY IF EXISTS "Units are visible to all" ON public.unidades_saude;
CREATE POLICY "Units are visible to all" ON public.unidades_saude
    FOR SELECT
    TO authenticated
    USING (true);

-- 5. Final check on permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.audit_vinculos_unidade TO authenticated;
GRANT ALL ON public.unidades_saude TO authenticated;
