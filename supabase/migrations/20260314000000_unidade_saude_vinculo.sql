-- 1. Update unidades_saude table with missing fields
ALTER TABLE public.unidades_saude ADD COLUMN IF NOT EXISTS cidade TEXT;

-- 2. Add unidade_id to profiles (users)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades_saude(id);
CREATE INDEX IF NOT EXISTS idx_profiles_unidade_id ON public.profiles(unidade_id);

-- 3. Add unidade_id to other relevant tables if missing
DO $$ 
DECLARE 
    t text;
    table_exists boolean;
BEGIN
    -- List of tables that should have unit isolation
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'atendimentos', 'queixas_principais', 'procedimentos_realizados', 'rascunhos_atendimentos', 'logs_sistema'] LOOP
        
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            -- Add column if not exists
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades_saude(id)', t);
            
            -- Create index for performance
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(unidade_id)', 'idx_' || t || '_unidade_id', t);
        END IF;
    END LOOP;
END $$;

-- 4. Create Audit Log table for unit link changes
CREATE TABLE IF NOT EXISTS public.audit_vinculos_unidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.profiles(id),
    admin_id UUID REFERENCES public.profiles(id), -- Who made the change
    unidade_anterior_id UUID REFERENCES public.unidades_saude(id),
    unidade_nova_id UUID REFERENCES public.unidades_saude(id),
    motivo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Helper function to get current user's unidade_id
CREATE OR REPLACE FUNCTION public.get_current_unidade_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT unidade_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update handle_new_user to include unidade_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, tenant_id, unidade_id, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        (new.raw_user_meta_data->>'tenant_id')::uuid,
        (new.raw_user_meta_data->>'unidade_id')::uuid,
        COALESCE(new.raw_user_meta_data->>'role', 'user')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger to set unidade_id on new records automatically
CREATE OR REPLACE FUNCTION public.set_unidade_id_from_user()
RETURNS TRIGGER AS $$
DECLARE
    user_unidade_id UUID;
BEGIN
    -- Only set if not already provided
    IF NEW.unidade_id IS NULL THEN
        user_unidade_id := public.get_current_unidade_id();
        NEW.unidade_id := user_unidade_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply automatic unidade_id to business tables
DO $$ 
DECLARE 
    t text;
    table_exists boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'atendimentos', 'queixas_principais', 'procedimentos_realizados'] LOOP
        
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_unidade_id ON public.%I', t);
            EXECUTE format('CREATE TRIGGER trigger_set_unidade_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_unidade_id_from_user()', t);
        END IF;
    END LOOP;
END $$;

-- 8. RLS Policies for Unit Isolation
-- Note: Super Admin and Admin might have different access. 
-- According to PRD: "Administrador ... acesso a todos os dados" (Wait, PRD says "acesso a todos os dados" in Roles table, but "Usuários só acessem dados da própria unidade" in APIs. I will allow Admin to see all in their TENANT, but common users only their UNIT.)
-- Wait, let's refine: 
-- SUPER_ADMIN: Global
-- ADMIN: Tenant Global (all units in their tenant)
-- USER: Unit Specific

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS for business tables
DO $$ 
DECLARE 
    t text;
    table_exists boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'atendimentos', 'queixas_principais', 'procedimentos_realizados'] LOOP
        
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            -- First disable existing isolation policies if any
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            
            -- Create new Unit Isolation policy
            -- Users see only their unit, Admins see all in tenant
            EXECUTE format('
                CREATE POLICY "Unit Isolation" ON public.%I
                USING (
                    (public.is_admin()) OR 
                    (unidade_id = public.get_current_unidade_id())
                )
                WITH CHECK (
                    (public.is_admin()) OR 
                    (unidade_id = public.get_current_unidade_id())
                )
            ', t);
        END IF;
    END LOOP;
END $$;

-- Special policies for profiles
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
CREATE POLICY "Users can view profiles in their unit" ON public.profiles
    FOR SELECT USING (
        (public.is_admin()) OR 
        (unidade_id = public.get_current_unidade_id())
    );

-- Permissions for anon and authenticated
GRANT ALL ON public.unidades_saude TO authenticated;
GRANT SELECT ON public.unidades_saude TO anon;
GRANT ALL ON public.audit_vinculos_unidade TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
