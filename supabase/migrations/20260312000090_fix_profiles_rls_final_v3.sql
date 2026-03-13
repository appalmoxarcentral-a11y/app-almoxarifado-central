-- Fix RLS Policies for Profiles (Version 3)
-- This version uses SECURITY DEFINER functions to bypass RLS and avoid infinite recursion.

-- 1. Reset all policies for profiles
DROP POLICY IF EXISTS "Profiles_Own_New" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Team_New" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_New" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Super_New" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view team members" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to manage team members" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin global access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_SuperAdmin_Policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_View_Own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_View_Team" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_Update_Team" ON public.profiles;

-- 2. Ensure all existing profiles have a tenant_id (Safety measure)
UPDATE public.profiles 
SET tenant_id = '00000000-0000-0000-0000-000000000000' 
WHERE tenant_id IS NULL;

-- 3. Create NEW policies using robust helper functions

-- Policy 1: SELECT (View)
-- Allows: Own profile, Team members (same tenant), Super Admin (all)
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id()
    );

-- Policy 2: INSERT/UPDATE/DELETE (Manage)
-- Allows: Own profile (limited), Admin of same tenant (except self-promotion), Super Admin (all)
CREATE POLICY "profiles_manage_policy" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    )
    WITH CHECK (
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    );

-- 4. Final check on helper functions
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- This function bypasses RLS because it is SECURITY DEFINER
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role text;
BEGIN
    -- This function bypasses RLS because it is SECURITY DEFINER
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
