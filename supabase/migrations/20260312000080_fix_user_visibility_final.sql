-- Diagnostic and Fix for Profile Visibility
-- This script ensures all users are visible to Super Admins and 
-- team members are visible to their Admins.

-- 1. Ensure all users have a profile (Safety sync)
INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'full_name', 'Usuário Sem Nome'),
    COALESCE((au.raw_user_meta_data->>'tenant_id')::uuid, '00000000-0000-0000-0000-000000000000'),
    COALESCE(au.raw_user_meta_data->>'role', 'user')
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Simplify and Fix RLS Policies for Profiles
-- We will use a mix of JWT and direct checks for maximum reliability.

DROP POLICY IF EXISTS "Profiles_Own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Team" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_Manage" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_SuperAdmin" ON public.profiles;

-- Rule 1: Super Admin can see and do EVERYTHING
CREATE POLICY "Profiles_SuperAdmin_Policy" ON public.profiles
    FOR ALL 
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Rule 2: Users can see their own profile
CREATE POLICY "Profiles_View_Own" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Rule 3: Users can see others in the SAME tenant
-- (This is what allows the Admin to see the Common User)
CREATE POLICY "Profiles_View_Team" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (tenant_id = public.get_current_tenant_id());

-- Rule 4: Admins can update users in their own tenant
CREATE POLICY "Profiles_Admin_Update_Team" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id = public.get_current_tenant_id() AND 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 3. Ensure get_current_tenant_id is extremely reliable
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Try to get from profile directly (most reliable)
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
    
    -- If not found, try JWT
    IF v_tenant_id IS NULL THEN
        v_tenant_id := (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid;
    END IF;
    
    RETURN COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
