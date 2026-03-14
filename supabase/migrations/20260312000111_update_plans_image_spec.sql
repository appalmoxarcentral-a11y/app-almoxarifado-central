-- Update Plan Limits and Prices according to latest image
-- Básico: R$ 99, 15 users, 100 products, 1500 patients
-- Profissional: R$ 299, 25 users, 250 products, 2500 patients
-- Empresarial: R$ 1, 99 users, 600 products, 5000 patients

UPDATE public.plans 
SET 
    price = 99.00,
    max_users = 15,
    max_products = 100,
    max_patients = 1500
WHERE name = 'Básico';

UPDATE public.plans 
SET 
    price = 299.00,
    max_users = 25,
    max_products = 250,
    max_patients = 2500
WHERE name = 'Profissional';

UPDATE public.plans 
SET 
    price = 1.00,
    max_users = 99,
    max_products = 600,
    max_patients = 5000
WHERE name = 'Empresarial';
