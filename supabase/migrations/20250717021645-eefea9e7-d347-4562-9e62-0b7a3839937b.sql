-- Fase 1 e 2: Habilitar RLS e Implementar Políticas de Segurança Detalhadas

-- Habilitar RLS em todas as tabelas principais que não têm
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispensacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rascunhos_compras ENABLE ROW LEVEL SECURITY;

-- Função de segurança para obter usuário atual e suas permissões
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    user_perms JSONB;
BEGIN
    SELECT permissoes INTO user_perms
    FROM public.usuarios 
    WHERE id = get_current_user_id() AND ativo = true;
    
    RETURN COALESCE(user_perms, '{}'::jsonb);
END;
$$;

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    user_type TEXT;
BEGIN
    SELECT tipo INTO user_type
    FROM public.usuarios 
    WHERE id = get_current_user_id() AND ativo = true;
    
    RETURN user_type = 'ADMIN';
END;
$$;

-- Função para verificar permissão específica
CREATE OR REPLACE FUNCTION public.has_permission(perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    user_perms JSONB;
BEGIN
    user_perms := get_current_user_permissions();
    RETURN COALESCE((user_perms ->> perm_name)::boolean, false);
END;
$$;

-- Políticas para USUARIOS - Apenas ADMINs podem gerenciar
CREATE POLICY "Admins podem ver todos os usuários" 
ON public.usuarios 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins podem criar usuários" 
ON public.usuarios 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins podem atualizar usuários" 
ON public.usuarios 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins podem excluir usuários" 
ON public.usuarios 
FOR DELETE 
USING (is_admin());

-- Políticas para PACIENTES - Usuários com permissão cadastro_pacientes
CREATE POLICY "Usuários podem ver pacientes se têm permissão" 
ON public.pacientes 
FOR SELECT 
USING (has_permission('cadastro_pacientes'));

CREATE POLICY "Usuários podem criar pacientes se têm permissão" 
ON public.pacientes 
FOR INSERT 
WITH CHECK (has_permission('cadastro_pacientes'));

CREATE POLICY "Usuários podem atualizar pacientes se têm permissão" 
ON public.pacientes 
FOR UPDATE 
USING (has_permission('cadastro_pacientes'));

CREATE POLICY "Usuários podem excluir pacientes se têm permissão" 
ON public.pacientes 
FOR DELETE 
USING (has_permission('cadastro_pacientes'));

-- Políticas para PRODUTOS - Usuários com permissão cadastro_produtos
CREATE POLICY "Usuários podem ver produtos se têm permissão" 
ON public.produtos 
FOR SELECT 
USING (has_permission('cadastro_produtos') OR has_permission('entrada_produtos') OR has_permission('dispensacao'));

CREATE POLICY "Usuários podem criar produtos se têm permissão" 
ON public.produtos 
FOR INSERT 
WITH CHECK (has_permission('cadastro_produtos'));

CREATE POLICY "Usuários podem atualizar produtos se têm permissão" 
ON public.produtos 
FOR UPDATE 
USING (has_permission('cadastro_produtos'));

CREATE POLICY "Usuários podem excluir produtos se têm permissão" 
ON public.produtos 
FOR DELETE 
USING (has_permission('cadastro_produtos'));

-- Políticas para ENTRADAS_PRODUTOS - Usuários com permissão entrada_produtos
CREATE POLICY "Usuários podem ver entradas se têm permissão" 
ON public.entradas_produtos 
FOR SELECT 
USING (has_permission('entrada_produtos') OR has_permission('historicos'));

CREATE POLICY "Usuários podem criar entradas se têm permissão" 
ON public.entradas_produtos 
FOR INSERT 
WITH CHECK (has_permission('entrada_produtos'));

CREATE POLICY "Usuários podem atualizar entradas se têm permissão" 
ON public.entradas_produtos 
FOR UPDATE 
USING (has_permission('entrada_produtos'));

CREATE POLICY "Usuários podem excluir entradas se têm permissão" 
ON public.entradas_produtos 
FOR DELETE 
USING (has_permission('entrada_produtos'));

-- Políticas para DISPENSACOES - Usuários com permissão dispensacao
CREATE POLICY "Usuários podem ver dispensações se têm permissão" 
ON public.dispensacoes 
FOR SELECT 
USING (has_permission('dispensacao') OR has_permission('historicos'));

CREATE POLICY "Usuários podem criar dispensações se têm permissão" 
ON public.dispensacoes 
FOR INSERT 
WITH CHECK (has_permission('dispensacao'));

CREATE POLICY "Usuários podem atualizar dispensações se têm permissão" 
ON public.dispensacoes 
FOR UPDATE 
USING (has_permission('dispensacao'));

CREATE POLICY "Usuários podem excluir dispensações se têm permissão" 
ON public.dispensacoes 
FOR DELETE 
USING (has_permission('dispensacao'));

-- Políticas para LOGS_SISTEMA - Apenas leitura para usuários com permissão historicos
CREATE POLICY "Usuários podem ver logs se têm permissão" 
ON public.logs_sistema 
FOR SELECT 
USING (has_permission('historicos') OR is_admin());

-- Políticas para UNIDADES_MEDIDA - Leitura geral, edição para quem tem permissões de produtos
CREATE POLICY "Usuários podem ver unidades de medida" 
ON public.unidades_medida 
FOR SELECT 
USING (true);

CREATE POLICY "Usuários podem criar unidades se têm permissão" 
ON public.unidades_medida 
FOR INSERT 
WITH CHECK (has_permission('cadastro_produtos') OR is_admin());

CREATE POLICY "Usuários podem atualizar unidades se têm permissão" 
ON public.unidades_medida 
FOR UPDATE 
USING (has_permission('cadastro_produtos') OR is_admin());

CREATE POLICY "Usuários podem excluir unidades se têm permissão" 
ON public.unidades_medida 
FOR DELETE 
USING (has_permission('cadastro_produtos') OR is_admin());

-- Políticas para RASCUNHOS_COMPRAS - Usuários podem ver/editar seus próprios rascunhos
CREATE POLICY "Usuários podem ver seus rascunhos" 
ON public.rascunhos_compras 
FOR SELECT 
USING (usuario_id = get_current_user_id());

CREATE POLICY "Usuários podem criar seus rascunhos" 
ON public.rascunhos_compras 
FOR INSERT 
WITH CHECK (usuario_id = get_current_user_id());

CREATE POLICY "Usuários podem atualizar seus rascunhos" 
ON public.rascunhos_compras 
FOR UPDATE 
USING (usuario_id = get_current_user_id());

CREATE POLICY "Usuários podem excluir seus rascunhos" 
ON public.rascunhos_compras 
FOR DELETE 
USING (usuario_id = get_current_user_id());

-- Fase 3: Correção das Funções do Banco para Segurança
CREATE OR REPLACE FUNCTION public.hash_senha(senha_texto text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN encode(digest(senha_texto, 'sha256'), 'hex');
END;
$$;

-- Atualizar função de contexto do usuário
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_user_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$;

-- Função para verificar senha
CREATE OR REPLACE FUNCTION public.verificar_senha(usuario_email TEXT, senha_input TEXT)
RETURNS TABLE(
    id UUID,
    nome TEXT,
    email TEXT,
    tipo public.tipo_usuario,
    permissoes JSONB,
    ativo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.nome, u.email, u.tipo, u.permissoes, u.ativo
    FROM public.usuarios u
    WHERE u.email = usuario_email 
    AND u.senha = hash_senha(senha_input)
    AND u.ativo = true;
END;
$$;

-- Garantir que os triggers existentes estão corretos
DROP TRIGGER IF EXISTS trigger_entrada_produto ON public.entradas_produtos;
CREATE TRIGGER trigger_entrada_produto
    AFTER INSERT ON public.entradas_produtos
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_entrada();

DROP TRIGGER IF EXISTS trigger_dispensacao ON public.dispensacoes;
CREATE TRIGGER trigger_dispensacao
    AFTER INSERT ON public.dispensacoes
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_dispensacao();