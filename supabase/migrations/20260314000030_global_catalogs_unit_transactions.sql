-- Ajuste de Visibilidade Global para Produtos e Pacientes (Tenant Isolation)
-- Mantém o isolamento de UNIDADE para transações (Entradas, Dispensações, Rascunhos)
-- Libera a visualização de CADASTROS (Produtos e Pacientes) para todas as unidades do mesmo município.

DO $$ 
DECLARE 
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
    -- 1. Aplicar Visibilidade GLOBAL (MUNICÍPIO) para Produtos e Pacientes
    FOREACH t IN ARRAY global_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Limpar políticas anteriores
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            
            -- Criar política de visibilidade por Município (Tenant)
            -- Permite que todas as unidades vejam os mesmos produtos e pacientes
            EXECUTE format('
                CREATE POLICY "Tenant Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    tenant_id = public.get_current_tenant_id()
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    tenant_id = public.get_current_tenant_id()
                )
            ', t);
            
            RAISE NOTICE 'Visibilidade Global (Município) aplicada à tabela de cadastro: %', t;
        END IF;
    END LOOP;

    -- 2. Garantir que Tabelas de TRANSAÇÃO continuem restritas por UNIDADE
    FOREACH t IN ARRAY unit_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Limpar e reafirmar o isolamento por Unidade
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            
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
            
            RAISE NOTICE 'Isolamento por Unidade mantido para tabela de transação: %', t;
        END IF;
    END LOOP;
END $$;
