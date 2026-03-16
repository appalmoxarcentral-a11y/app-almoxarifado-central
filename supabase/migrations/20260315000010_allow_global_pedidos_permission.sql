-- Atualização de Segurança para Acesso Global de Pedidos
-- Esta migração ajusta as políticas de RLS para respeitar a nova permissão 'acesso_global_pedidos'

DO $$ 
BEGIN
    -- 1. Atualizar a política da tabela rascunhos_compras
    DROP POLICY IF EXISTS "Strict Unit Isolation" ON public.rascunhos_compras;
    DROP POLICY IF EXISTS "Unit Isolation" ON public.rascunhos_compras;

    CREATE POLICY "Pedidos Global Access Policy" ON public.rascunhos_compras
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (
                public.is_admin() OR 
                (SELECT (permissions->>'acesso_global_pedidos')::boolean FROM public.profiles WHERE id = auth.uid()) = true OR
                unidade_id = public.get_current_unidade_id()
            )
        )
    )
    WITH CHECK (
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (
                public.is_admin() OR 
                (SELECT (permissions->>'acesso_global_pedidos')::boolean FROM public.profiles WHERE id = auth.uid()) = true OR
                unidade_id = public.get_current_unidade_id()
            )
        )
    );

    RAISE NOTICE 'Política de acesso global aos pedidos atualizada.';
END $$;
