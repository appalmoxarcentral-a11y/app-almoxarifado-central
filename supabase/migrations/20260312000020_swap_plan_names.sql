
-- Swap names and descriptions of Básico and Profissional plans
-- Currently: Básico = 299, Profissional = 99
-- Goal: Básico = 99, Profissional = 299

DO $$
DECLARE
    basic_id UUID;
    prof_id UUID;
BEGIN
    SELECT id INTO basic_id FROM public.plans WHERE name = 'Básico';
    SELECT id INTO prof_id FROM public.plans WHERE name = 'Profissional';

    -- Temporary name to avoid conflict if there were unique constraints (there aren't, but good practice)
    UPDATE public.plans SET name = 'Temp' WHERE id = basic_id;
    
    UPDATE public.plans 
    SET name = 'Básico', 
        description = 'Ideal para pequenas unidades'
    WHERE id = prof_id;

    UPDATE public.plans 
    SET name = 'Profissional', 
        description = 'Para unidades em crescimento'
    WHERE id = basic_id;
END $$;
