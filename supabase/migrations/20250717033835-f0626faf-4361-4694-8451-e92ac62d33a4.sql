-- Migrar dados da tabela relatorios_compras_rascunho para rascunhos_compras
INSERT INTO public.rascunhos_compras (
  usuario_id,
  nome_rascunho,
  dados_produtos,
  data_criacao,
  data_atualizacao,
  ativo
)
SELECT 
  usuario_id,
  nome_rascunho,
  items as dados_produtos,
  data_criacao,
  data_atualizacao,
  NOT finalizado as ativo  -- finalizado = false vira ativo = true
FROM public.relatorios_compras_rascunho
WHERE finalizado = false;  -- Só migra os rascunhos não finalizados

-- Remover trigger antes de excluir a função
DROP TRIGGER IF EXISTS update_relatorios_compras_rascunho_updated_at ON public.relatorios_compras_rascunho;

-- Excluir a função relacionada
DROP FUNCTION IF EXISTS public.update_relatorio_compras_rascunho_updated_at();

-- Excluir a tabela não utilizada
DROP TABLE IF EXISTS public.relatorios_compras_rascunho;