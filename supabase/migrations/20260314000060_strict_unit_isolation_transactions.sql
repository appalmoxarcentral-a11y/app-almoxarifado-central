-- Isolamento Estrito por Unidade para Transações (Mesmo para Admins)
-- Garante que entradas e dispensações sejam filtradas pela unidade atual do usuário logado.

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
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Remover políticas antigas
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            
            -- Criar política de isolamento estrito
            -- Agora ignoramos se o usuário é Admin ou Super Admin para a visualização de transações
            -- Ele verá APENAS o que pertence à unidade que está vinculada no seu perfil agora.
            EXECUTE format('
                CREATE POLICY "Strict Unit Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    unidade_id = public.get_current_unidade_id()
                )
                WITH CHECK (
                    unidade_id = public.get_current_unidade_id()
                )
            ', t);
            
            RAISE NOTICE 'Isolamento estrito aplicado à tabela: %', t;
        END IF;
    END LOOP;
END $$;
