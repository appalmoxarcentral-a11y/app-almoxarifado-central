-- CORREÇÃO DE ESTOQUE POR UNIDADE
-- Garante que o catálogo de produtos seja global, mas o cálculo de estoque seja individual por unidade.

-- 1. Criar função para calcular estoque por unidade
CREATE OR REPLACE FUNCTION public.get_estoque_por_unidade(p_produto_id UUID, p_unidade_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_entradas INTEGER;
    v_saidas INTEGER;
BEGIN
    -- Somar todas as entradas daquele produto nesta unidade
    SELECT COALESCE(SUM(quantidade), 0) INTO v_entradas
    FROM public.entradas_produtos
    WHERE produto_id = p_produto_id AND unidade_id = p_unidade_id;

    -- Somar todas as saídas (dispensações) daquele produto nesta unidade
    SELECT COALESCE(SUM(quantidade), 0) INTO v_saidas
    FROM public.dispensacoes
    WHERE produto_id = p_produto_id AND unidade_id = p_unidade_id;

    RETURN v_entradas - v_saidas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. (Opcional) Criar uma View para facilitar a consulta de estoque por unidade
DROP VIEW IF EXISTS public.view_estoque_unidades;
CREATE VIEW public.view_estoque_unidades AS
SELECT 
    p.id as produto_id,
    p.descricao,
    u.id as unidade_id,
    u.nome as unidade_nome,
    public.get_estoque_por_unidade(p.id, u.id) as estoque_atual
FROM 
    public.produtos p
CROSS JOIN 
    public.unidades_saude u;

GRANT SELECT ON public.view_estoque_unidades TO authenticated;
