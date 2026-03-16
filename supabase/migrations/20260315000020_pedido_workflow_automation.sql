-- Migração para Fluxo de Autorização e Entrega de Pedidos SMSA
-- Adiciona status, controle de autorização e automação de estoque.

-- 1. Adicionar novas colunas à tabela rascunhos_compras
ALTER TABLE public.rascunhos_compras 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'autorizado', 'entregue')),
ADD COLUMN IF NOT EXISTS autorizado_por_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS data_autorizacao TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS entregue_por_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ;

-- 2. Função para processar a entrega e atualizar o estoque automaticamente
CREATE OR REPLACE FUNCTION public.processar_entrega_pedido()
RETURNS TRIGGER AS $$
DECLARE
    v_item JSONB;
    v_unidade_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Só executa se o status mudou para 'entregue'
    IF (OLD.status = 'autorizado' AND NEW.status = 'entregue') THEN
        v_unidade_id := NEW.unidade_id;
        v_tenant_id := NEW.tenant_id;

        -- Iterar sobre os itens do pedido salvos no JSONB dados_produtos
        -- O JSONB deve ser um array de objetos: [{"id": "...", "quantidade_reposicao": 500}, ...]
        FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.dados_produtos)
        LOOP
            -- Apenas se houver quantidade solicitada
            IF (v_item->>'quantidade_reposicao')::numeric > 0 THEN
                INSERT INTO public.entradas_produtos (
                    produto_id,
                    unidade_id,
                    tenant_id,
                    quantidade,
                    lote,
                    data_vencimento,
                    data_entrada,
                    created_at
                ) VALUES (
                    (v_item->>'id')::UUID,
                    v_unidade_id,
                    v_tenant_id,
                    (v_item->>'quantidade_reposicao')::numeric,
                    'PEDIDO-' || to_char(NEW.data_entrega, 'DDMMYY'), -- Lote automático identificando o pedido
                    CURRENT_DATE + INTERVAL '2 years', -- Vencimento padrão (pode ser ajustado)
                    CURRENT_DATE,
                    NOW()
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger para disparar a automação na entrega
DROP TRIGGER IF EXISTS trigger_processar_entrega ON public.rascunhos_compras;
CREATE TRIGGER trigger_processar_entrega
    AFTER UPDATE OF status ON public.rascunhos_compras
    FOR EACH ROW
    WHEN (NEW.status = 'entregue')
    EXECUTE FUNCTION public.processar_entrega_pedido();

-- 4. Atualizar RLS para permitir que quem tem acesso global altere o status
DROP POLICY IF EXISTS "Pedidos Global Access Policy" ON public.rascunhos_compras;
CREATE POLICY "Pedidos Global Access Policy" ON public.rascunhos_compras
FOR ALL
TO authenticated
USING (
    public.is_super_admin() OR 
    (
        tenant_id = public.get_current_tenant_id() AND 
        (
            public.is_admin() OR 
            (SELECT COALESCE((permissions->>'acesso_global_pedidos')::boolean, false) FROM public.profiles WHERE id = auth.uid()) = true OR
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
            (SELECT COALESCE((permissions->>'acesso_global_pedidos')::boolean, false) FROM public.profiles WHERE id = auth.uid()) = true OR
            unidade_id = public.get_current_unidade_id()
        )
    )
);
