-- Fix Plan Limits to use 'produtos' table instead of 'produtos_master'

-- 1. Remove old trigger if it exists on the renamed/deleted table
DROP TRIGGER IF EXISTS tr_check_product_limit ON public.produtos_master;

-- 2. Update check_plan_limits function
CREATE OR REPLACE FUNCTION public.check_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_plan_id UUID;
    v_max_users INTEGER;
    v_max_products INTEGER;
    v_max_patients INTEGER;
    v_current_count INTEGER;
BEGIN
    -- Determine tenant_id based on table
    IF TG_TABLE_NAME = 'profiles' THEN
        v_tenant_id := NEW.tenant_id;
    ELSIF TG_TABLE_NAME = 'produtos' THEN
        v_tenant_id := NEW.tenant_id;
    ELSIF TG_TABLE_NAME = 'pacientes' THEN
        v_tenant_id := NEW.tenant_id;
    END IF;

    -- Legacy tenant is never limited
    IF v_tenant_id = '00000000-0000-0000-0000-000000000000' THEN
        RETURN NEW;
    END IF;

    -- Get plan limits
    SELECT p.max_users, p.max_products, p.max_patients
    INTO v_max_users, v_max_products, v_max_patients
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE s.tenant_id = v_tenant_id AND s.status = 'active'
    LIMIT 1;

    -- Default if no active subscription found
    IF NOT FOUND THEN
        -- Allow insertion if it's the first user (onboarding)
        IF TG_TABLE_NAME = 'profiles' THEN
            RETURN NEW;
        END IF;
        -- For Super Admin or special cases, we might want to skip this, 
        -- but for standard users, they need an active subscription.
        IF public.is_super_admin() THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Tenant sem assinatura ativa.';
    END IF;

    -- Check limits
    IF TG_TABLE_NAME = 'profiles' THEN
        IF v_max_users IS NOT NULL THEN
            SELECT count(*) INTO v_current_count FROM public.profiles WHERE tenant_id = v_tenant_id;
            IF v_current_count >= v_max_users THEN
                RAISE EXCEPTION 'Limite de usuários atingido para este plano (% usuários)', v_max_users;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'produtos' THEN
        IF v_max_products IS NOT NULL THEN
            SELECT count(*) INTO v_current_count FROM public.produtos WHERE tenant_id = v_tenant_id;
            IF v_current_count >= v_max_products THEN
                RAISE EXCEPTION 'Limite de produtos atingido para este plano (% produtos)', v_max_products;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'pacientes' THEN
        IF v_max_patients IS NOT NULL THEN
            SELECT count(*) INTO v_current_count FROM public.pacientes WHERE tenant_id = v_tenant_id;
            IF v_current_count >= v_max_patients THEN
                RAISE EXCEPTION 'Limite de pacientes atingido para este plano (% pacientes)', v_max_patients;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add trigger to 'produtos' table
DROP TRIGGER IF EXISTS tr_check_product_limit ON public.produtos;
CREATE TRIGGER tr_check_product_limit
    BEFORE INSERT ON public.produtos
    FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();
