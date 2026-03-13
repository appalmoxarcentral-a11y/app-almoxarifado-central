-- Update Plano Básico with new limits
-- Basic: 25 users, 250 products, 2500 patients (R$ 99/mês)
UPDATE public.plans 
SET 
    max_users = 25, 
    max_products = 250, 
    max_patients = 2500,
    price = 99.00
WHERE name = 'Básico';

-- Ensure SUPER_ADMIN can edit plans via RLS
DROP POLICY IF EXISTS "Super admins can manage plans" ON public.plans;
CREATE POLICY "Super admins can manage plans" ON public.plans
    FOR ALL USING (public.is_super_admin());
