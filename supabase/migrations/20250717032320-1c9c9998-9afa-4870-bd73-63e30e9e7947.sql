-- Rollback completo para estado pré-16 de julho
-- ATENÇÃO: Remove TODAS as proteções de segurança

-- 1. Desabilitar RLS nas tabelas principais
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas_produtos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispensacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_sistema DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_medida DISABLE ROW LEVEL SECURITY;

-- 2. Remover todas as políticas RLS das tabelas principais
DROP POLICY IF EXISTS "Permitir acesso completo para usuários autenticados" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir acesso completo para usuários autenticados" ON public.pacientes;
DROP POLICY IF EXISTS "Permitir acesso completo para usuários autenticados" ON public.produtos;
DROP POLICY IF EXISTS "Permitir acesso completo para usuários autenticados" ON public.entradas_produtos;
DROP POLICY IF EXISTS "Permitir acesso completo para usuários autenticados" ON public.dispensacoes;
DROP POLICY IF EXISTS "Permitir leitura para usuários autenticados" ON public.logs_sistema;

-- Remover políticas antigas das unidades_medida se existirem
DROP POLICY IF EXISTS "Usuários podem ver unidades de medida" ON public.unidades_medida;
DROP POLICY IF EXISTS "Usuários podem criar unidades se têm permissão" ON public.unidades_medida;
DROP POLICY IF EXISTS "Usuários podem atualizar unidades se têm permissão" ON public.unidades_medida;
DROP POLICY IF EXISTS "Usuários podem excluir unidades se têm permissão" ON public.unidades_medida;

-- 3. Remover funções de segurança criadas no dia 17
DROP FUNCTION IF EXISTS public.get_current_user_permissions();
DROP FUNCTION IF EXISTS public.has_permission(text);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_current_user_id();
DROP FUNCTION IF EXISTS public.set_current_user_id(uuid);

-- 4. Restaurar função hash_senha para versão simples (sem extensions.digest)
CREATE OR REPLACE FUNCTION public.hash_senha(senha_texto text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(digest(senha_texto, 'sha256'), 'hex');
END;
$$;

-- 5. Restaurar função verificar_senha para versão original simples
CREATE OR REPLACE FUNCTION public.verificar_senha(usuario_email TEXT, senha_input TEXT)
RETURNS TABLE(id uuid, nome text, email text, tipo tipo_usuario, permissoes jsonb, ativo boolean)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.nome, u.email, u.tipo, u.permissoes, u.ativo
    FROM public.usuarios u
    WHERE u.email = usuario_email 
    AND u.senha = public.hash_senha(senha_input)
    AND u.ativo = true;
END;
$$;

-- 6. Limpar e recriar políticas simples para tabelas de rascunhos usando auth.uid() diretamente
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem excluir seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios rascunhos de relatóri" ON public.relatorios_compras_rascunho;

-- Recriar políticas simples para rascunhos usando auth.uid()
CREATE POLICY "Usuários podem gerenciar seus próprios rascunhos"
ON public.rascunhos_compras
FOR ALL
USING (auth.uid()::text = usuario_id::text);

CREATE POLICY "Usuários podem gerenciar seus próprios relatórios"
ON public.relatorios_compras_rascunho
FOR ALL
USING (auth.uid()::text = usuario_id::text);