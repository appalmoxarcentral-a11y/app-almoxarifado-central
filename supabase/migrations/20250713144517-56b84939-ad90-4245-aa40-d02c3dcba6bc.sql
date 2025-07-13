-- Criar função para definir o ID do usuário atual na sessão
CREATE OR REPLACE FUNCTION public.set_current_user_id(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id_param::text, false);
END;
$$;

-- Criar função para obter o ID do usuário atual da sessão
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_user_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$;

-- Remover políticas RLS existentes da tabela relatorios_compras_rascunho
DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem excluir seus próprios rascunhos" ON public.relatorios_compras_rascunho;

-- Criar novas políticas RLS usando a função customizada
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