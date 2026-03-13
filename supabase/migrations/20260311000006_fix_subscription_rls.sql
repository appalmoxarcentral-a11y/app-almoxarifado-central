-- Enable RLS on Plans and Subscriptions tables
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy for Plans: Everyone can read plans (public reference data)
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans" ON public.plans
    FOR SELECT USING (true);

-- Policy for Subscriptions: Tenant isolation
DROP POLICY IF EXISTS "Users can view their own tenant subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own tenant subscription" ON public.subscriptions
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());

-- Allow system/admin to manage subscriptions (usually via edge functions or triggers, but for now allow insert for onboarding)
DROP POLICY IF EXISTS "Users can create subscription during onboarding" ON public.subscriptions;
CREATE POLICY "Users can create subscription during onboarding" ON public.subscriptions
    FOR INSERT 
    WITH CHECK (tenant_id = public.get_current_tenant_id());
