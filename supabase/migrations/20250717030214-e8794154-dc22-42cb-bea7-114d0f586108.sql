-- Corrigir políticas RLS da tabela relatorios_compras_rascunho para usar get_current_user_id()

-- Remover políticas existentes que usam auth.uid()
DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem excluir seus próprios rascunhos" ON public.relatorios_compras_rascunho;

-- Criar novas políticas usando get_current_user_id()
CREATE POLICY "Usuários podem visualizar seus próprios rascunhos"
ON public.relatorios_compras_rascunho
FOR SELECT
USING (usuario_id = public.get_current_user_id());

CREATE POLICY "Usuários podem criar seus próprios rascunhos"
ON public.relatorios_compras_rascunho
FOR INSERT
WITH CHECK (usuario_id = public.get_current_user_id());

CREATE POLICY "Usuários podem atualizar seus próprios rascunhos"
ON public.relatorios_compras_rascunho
FOR UPDATE
USING (usuario_id = public.get_current_user_id());

CREATE POLICY "Usuários podem excluir seus próprios rascunhos"
ON public.relatorios_compras_rascunho
FOR DELETE
USING (usuario_id = public.get_current_user_id());