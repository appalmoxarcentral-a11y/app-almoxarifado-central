-- 1. Add max_patients to plans table
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_patients INTEGER;

-- 2. Update existing plans with new limits (based on user request)
-- Note: 'max_products' and 'max_patients' = NULL means unlimited

-- Plano Básico: 2 users, 100 products, 500 patients (R$ 99/mês)
UPDATE public.plans 
SET 
    max_users = 2, 
    max_products = 100, 
    max_patients = 500,
    price = 99.00
WHERE name = 'Básico';

-- Plano Profissional: 20 users, 2000 products, 5000 patients (R$ 199/mês)
UPDATE public.plans 
SET 
    max_users = 20, 
    max_products = 2000, 
    max_patients = 5000,
    price = 199.00
WHERE name = 'Profissional';

-- Plano Empresarial: 100 users, unlimited products, unlimited patients (R$ 499/mês)
UPDATE public.plans 
SET 
    max_users = 100, 
    max_products = NULL, 
    max_patients = NULL,
    price = 499.00
WHERE name = 'Empresarial';

-- 3. Ensure any new plan inserted in the future follows this structure
-- This is just for completeness if someone deletes and re-inserts
-- (Though the UPDATE above is sufficient for current data)
