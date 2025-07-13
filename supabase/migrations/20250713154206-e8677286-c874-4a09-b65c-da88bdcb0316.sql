-- Atualizar permissões do usuário para incluir relatorio_compras e gerenciar_rascunhos_compras
UPDATE public.usuarios 
SET permissoes = jsonb_set(
  jsonb_set(permissoes, '{relatorio_compras}', 'true'),
  '{gerenciar_rascunhos_compras}', 
  'true'
)
WHERE id = 'b633052e-7fc6-4843-8e5c-0a6623fb8d58';