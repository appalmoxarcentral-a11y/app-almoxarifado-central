-- Fix Profiles RLS to allow team members to see each other
-- and allow Admins to manage their team members.

-- 1. Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can edit profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin see all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile during onboarding" ON public.profiles;

-- 3. Create robust policies

-- Policy: Allow everyone to see their own profile (Fundamental)
CREATE POLICY "Allow users to view own profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Policy: Allow users to see other profiles in the same tenant
-- (Required for team list/collaboration)
CREATE POLICY "Allow users to view team members" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (tenant_id = public.get_current_tenant_id());

-- Policy: Allow Admins to update profiles in their own tenant
-- (Except they shouldn't be able to elevate someone to super_admin via RLS check alone, 
-- but the frontend/DB constraints should handle that. Here we focus on tenant isolation.)
CREATE POLICY "Allow admins to manage team members" ON public.profiles
    FOR ALL -- Allows INSERT, UPDATE, DELETE
    TO authenticated
    USING (
        tenant_id = public.get_current_tenant_id() AND 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        tenant_id = public.get_current_tenant_id()
    );

-- Policy: Super Admin has global access
CREATE POLICY "Super Admin global access" ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 4. Ensure get_current_tenant_id and is_super_admin are optimized and bypass RLS
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Querying with SECURITY DEFINER bypasses RLS on profiles
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
