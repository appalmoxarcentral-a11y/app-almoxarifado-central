
-- Migration to fix login issues and ensure all users have profiles
-- and can access their own data.

-- 1. Ensure users can always view their own profile (Fixes circular dependency in get_current_tenant_id)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- 2. Sync existing auth.users to public.profiles if they are missing
-- This handles users created before the trigger was active or if trigger failed
INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'full_name', 'Usuário'),
    COALESCE((au.raw_user_meta_data->>'tenant_id')::uuid, '00000000-0000-0000-0000-000000000000'),
    COALESCE(au.raw_user_meta_data->>'role', 'user')
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Update is_super_admin to be more efficient
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Robustify get_current_tenant_id
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ensure Super Admin can bypass all RLS for maintenance
-- This was already partially done but we ensure it for profiles too
DROP POLICY IF EXISTS "Super Admin full access on profiles" ON public.profiles;
CREATE POLICY "Super Admin full access on profiles" ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
