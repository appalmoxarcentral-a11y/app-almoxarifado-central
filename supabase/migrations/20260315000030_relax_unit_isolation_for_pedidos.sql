-- Atualização de Segurança: Relaxar Isolamento Estrito para Gestão de Pedidos
-- Permite que usuários com permissão 'acesso_global_pedidos' ou Super Admins vejam transações de outras unidades.
-- Isso é necessário para que o Almoxarifado Central possa ver o estoque da unidade solicitante.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY['entradas_produtos', 'dispensacoes'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Remover políticas antigas
            EXECUTE format('DROP POLICY IF EXISTS "Strict Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Global Access for Pedidos" ON public.%I', t);
            
            -- Criar nova política flexível
            -- 1. Usuário vê sua própria unidade (Isolamento padrão)
            -- 2. Super Admin vê tudo (Global)
            -- 3. Usuário com 'acesso_global_pedidos' vê tudo (Global) - necessário para validar pedidos
            EXECUTE format('
                CREATE POLICY "Global Access for Pedidos" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    unidade_id = public.get_current_unidade_id() OR
                    public.is_super_admin() OR
                    (
                        SELECT COALESCE((permissions->>''acesso_global_pedidos'')::boolean, false) 
                        FROM public.profiles 
                        WHERE id = auth.uid()
                    ) = true
                )
                WITH CHECK (
                    unidade_id = public.get_current_unidade_id() OR
                    public.is_super_admin() OR
                    (
                        SELECT COALESCE((permissions->>''acesso_global_pedidos'')::boolean, false) 
                        FROM public.profiles 
                        WHERE id = auth.uid()
                    ) = true
                )
            ', t);
            
            RAISE NOTICE 'Política Global Access for Pedidos aplicada à tabela: %', t;
        END IF;
    END LOOP;
END $$;
