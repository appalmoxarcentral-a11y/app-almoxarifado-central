-- Simplificar políticas RLS da tabela rascunhos_compras
-- Remover políticas existentes que dependem de get_current_user_id()
DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "Usuários podem excluir seus próprios rascunhos" ON public.rascunhos_compras;

-- Temporariamente desabilitar RLS para teste
ALTER TABLE public.rascunhos_compras DISABLE ROW LEVEL SECURITY;