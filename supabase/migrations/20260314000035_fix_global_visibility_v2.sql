-- Ajuste de Visibilidade Global para Produtos e Pacientes (Tenant Isolation + Master Catalog)
-- Mantém o isolamento de UNIDADE para transações (Entradas, Dispensações, Rascunhos)
-- Libera a visualização de CADASTROS (Produtos e Pacientes) para todas as unidades do mesmo município e catálogo mestre.

DO $$ 
DECLARE 
    master_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
    t text;
    -- Tabelas de CADASTRO que devem ser globais no município (tenant)
    global_tables text[] := ARRAY['produtos', 'pacientes'];
    -- Tabelas de TRANSAÇÃO que devem ser restritas por UNIDADE
    unit_tables text[] := ARRAY[
        'entradas_produtos', 
        'dispensacoes', 
        'rascunhos_compras', 
        'relatorios_compras_rascunho',
        'atendimentos',
        'queixas_principais',
        'procedimentos_realizados',
        'rascunhos_atendimentos'
    ];
BEGIN
    -- 1. Aplicar Visibilidade GLOBAL (MUNICÍPIO + MASTER) para Produtos e Pacientes
    FOREACH t IN ARRAY global_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Limpar políticas anteriores para evitar conflitos (OR logic do Supabase)
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Global Tenant Visibility" ON public.%I', t);
            
            -- Habilitar RLS se não estiver habilitado
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            -- Criar política de visibilidade por Município (Tenant) + Catálogo Mestre
            -- SELECT: Permite ver produtos/pacientes do seu município OU do catálogo mestre (zeros)
            EXECUTE format('
                CREATE POLICY "Global Tenant Visibility" ON public.%I
                FOR SELECT
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    tenant_id = public.get_current_tenant_id() OR
                    tenant_id = %L
                )
            ', t, master_tenant_id);

            -- INSERT/UPDATE/DELETE: Apenas Admins do próprio município ou Super Admin podem alterar
            -- Nota: Mantemos o WITH CHECK para garantir que ao inserir, o tenant_id seja respeitado
            EXECUTE format('
                CREATE POLICY "Admin Tenant Management" ON public.%I
                FOR ALL 
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    (tenant_id = public.get_current_tenant_id() AND public.is_admin())
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    (tenant_id = public.get_current_tenant_id() AND public.is_admin())
                )
            ', t);
            
            RAISE NOTICE 'Visibilidade Global (Município + Master) aplicada à tabela: %', t;
        END IF;
    END LOOP;

    -- 2. Reafirmar Isolamento por UNIDADE para Tabelas de TRANSAÇÃO
    FOREACH t IN ARRAY unit_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Limpar políticas antigas
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Global Tenant Visibility" ON public.%I', t);
            
            -- Habilitar RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            -- Criar política estrita de Unidade
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
            
            RAISE NOTICE 'Isolamento por Unidade (Unit Isolation) reafirmado para tabela: %', t;
        END IF;
    END LOOP;
END $$;
