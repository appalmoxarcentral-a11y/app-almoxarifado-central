-- Adicionar coluna prioridade à tabela produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS prioridade INTEGER DEFAULT 0;

-- Comentário para explicar os níveis (opcional)
COMMENT ON COLUMN public.produtos.prioridade IS 'Nível de prioridade do produto (1-3 para itens prioritários no topo)';
