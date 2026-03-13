-- 1. Ensure produtos_master has tenant_id and RLS
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos_master') THEN
        -- Add tenant_id if not exists
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'produtos_master' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.produtos_master ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
            UPDATE public.produtos_master SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
            ALTER TABLE public.produtos_master ALTER COLUMN tenant_id SET NOT NULL;
        END IF;
        
        -- Enable RLS
        ALTER TABLE public.produtos_master ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation" ON public.produtos_master;
        CREATE POLICY "Tenant Isolation" ON public.produtos_master USING (tenant_id = public.get_current_tenant_id());
    END IF;
END $$;

-- 2. Ensure profiles has RLS enabled (it was disabled in supabase_get_tables output)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create function to check plan limits
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
    ELSIF TG_TABLE_NAME = 'produtos_master' THEN
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
    ELSIF TG_TABLE_NAME = 'produtos_master' THEN
        IF v_max_products IS NOT NULL THEN
            SELECT count(*) INTO v_current_count FROM public.produtos_master WHERE tenant_id = v_tenant_id;
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

-- 4. Add triggers
DROP TRIGGER IF EXISTS tr_check_user_limit ON public.profiles;
CREATE TRIGGER tr_check_user_limit
    BEFORE INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();

DROP TRIGGER IF EXISTS tr_check_product_limit ON public.produtos_master;
CREATE TRIGGER tr_check_product_limit
    BEFORE INSERT ON public.produtos_master
    FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();

DROP TRIGGER IF EXISTS tr_check_patient_limit ON public.pacientes;
CREATE TRIGGER tr_check_patient_limit
    BEFORE INSERT ON public.pacientes
    FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();
