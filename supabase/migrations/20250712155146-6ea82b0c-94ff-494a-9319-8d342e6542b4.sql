-- Adicionar nova permissão relatorio_compras a todos os usuários existentes
UPDATE public.usuarios 
SET permissoes = permissoes || '{"relatorio_compras": false}'::jsonb
WHERE NOT (permissoes ? 'relatorio_compras');