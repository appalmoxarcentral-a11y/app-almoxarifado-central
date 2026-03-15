-- Restrição total de acesso por Unidade de Saúde (Unit Isolation)
-- Garante que uma unidade não veja dados de outra (entradas, dispensações, rascunhos, etc.)
-- Administradores continuam vendo tudo no Tenant (Município), Super Admins veem tudo globalmente.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY[
        'entradas_produtos', 
        'dispensacoes', 
        'rascunhos_compras', 
        'relatorios_compras_rascunho',
        'pacientes',
        'produtos',
        'atendimentos',
        'queixas_principais',
        'procedimentos_realizados',
        'rascunhos_atendimentos'
    ];
BEGIN
    -- 1. Garantir que a função get_current_unidade_id seja robusta
    CREATE OR REPLACE FUNCTION public.get_current_unidade_id()
    RETURNS UUID AS $func$
    BEGIN
        RETURN (SELECT unidade_id FROM public.profiles WHERE id = auth.uid());
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 2. Garantir que a função is_admin() seja robusta
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS BOOLEAN AS $func$
    BEGIN
        RETURN EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
        );
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 2.1 Função para preenchimento automático de tenant_id e unidade_id
    CREATE OR REPLACE FUNCTION public.set_unit_and_tenant_from_user()
    RETURNS TRIGGER AS $func$
    BEGIN
        IF NEW.tenant_id IS NULL THEN
            NEW.tenant_id := public.get_current_tenant_id();
        END IF;
        IF NEW.unidade_id IS NULL THEN
            NEW.unidade_id := public.get_current_unidade_id();
        END IF;
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 3. Iterar sobre as tabelas e aplicar a restrição por Unidade
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            
            -- 3.1 Garantir que a coluna tenant_id existe (Multi-tenancy)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'tenant_id') THEN
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT public.get_current_tenant_id()', t);
                RAISE NOTICE 'Coluna tenant_id adicionada à tabela: %', t;
            END IF;

            -- 3.2 Garantir que a coluna unidade_id existe (Unit Isolation)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'unidade_id') THEN
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN unidade_id UUID REFERENCES public.unidades_saude(id) DEFAULT public.get_current_unidade_id()', t);
                RAISE NOTICE 'Coluna unidade_id adicionada à tabela: %', t;
            END IF;

            -- 3.3 Aplicar trigger de preenchimento automático
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_unit_and_tenant_id ON public.%I', t);
            EXECUTE format('CREATE TRIGGER trigger_set_unit_and_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_unit_and_tenant_from_user()', t);

            -- Remover políticas conflitantes antigas
            EXECUTE format('DROP POLICY IF EXISTS "Admin and User Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "User Isolation" ON public.%I', t);
            
            -- Criar a nova política de isolamento por Unidade
            EXECUTE format('
                CREATE POLICY "Unit Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.is_admin() OR unidade_id = public.get_current_unidade_id())
                    )
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.is_admin() OR unidade_id = public.get_current_unidade_id())
                    )
                )
            ', t);
            
            RAISE NOTICE 'Política de Isolamento por Unidade aplicada à tabela: %', t;
        END IF;
    END LOOP;
END $$;
