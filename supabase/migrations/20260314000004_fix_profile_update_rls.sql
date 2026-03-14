-- Fix profile update RLS to allow users to link themselves to a unit
-- This migration updates the manage policy to include the user themselves

-- 1. Drop existing policy
DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;

-- 2. Re-create with self-update permission
CREATE POLICY "profiles_manage_policy" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        id = auth.uid() OR -- ALLOW USERS TO MANAGE THEIR OWN PROFILE
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    )
    WITH CHECK (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    );

-- 3. Ensure users can always see their own profile even without unit
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id() OR
        unidade_id = (SELECT unidade_id FROM public.profiles WHERE id = auth.uid())
    );
