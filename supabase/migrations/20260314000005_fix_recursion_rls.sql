-- Fix profile update RLS and infinite recursion
-- This version uses SECURITY DEFINER functions to bypass RLS and avoid infinite recursion.

-- 1. Helper functions (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_unidade_id()
RETURNS UUID AS $$
DECLARE
    v_unidade_id UUID;
BEGIN
    SELECT unidade_id INTO v_unidade_id FROM public.profiles WHERE id = auth.uid();
    RETURN v_unidade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing policies for profiles
DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 3. Re-create policies using helper functions
-- SELECT Policy
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id() OR
        unidade_id = public.get_user_unidade_id()
    );

-- MANAGE Policy (INSERT, UPDATE, DELETE)
CREATE POLICY "profiles_manage_policy" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        id = auth.uid() OR -- ALLOW USERS TO MANAGE THEIR OWN PROFILE (e.g., self-link to unit)
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
