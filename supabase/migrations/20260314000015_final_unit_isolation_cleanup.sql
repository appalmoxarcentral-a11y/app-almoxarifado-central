-- Limpeza e Restrição Definitiva por Unidade (Unit Isolation)
-- Resolve o problema de rascunhos e dados sendo visíveis entre unidades do mesmo tenant.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY[
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
    -- 1. Iterar sobre as tabelas e remover TODAS as políticas antigas para evitar sobreposição (OR)
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Remover TODAS as possíveis políticas que ignoram a unidade
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Admin and User Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit and User Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "User Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios rascunhos" ON public.%I', t);
            
            -- 2. Criar a política definitiva de Isolamento por Unidade
            -- Regra: 
            --   - Super Admin: Vê tudo.
            --   - Admin do Tenant: Vê tudo do seu tenant (município).
            --   - Usuário Comum: Vê APENAS o que pertence à sua unidade_id.
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
            
            RAISE NOTICE 'Políticas limpas e Isolamento por Unidade aplicado à tabela: %', t;
        END IF;
    END LOOP;
END $$;
