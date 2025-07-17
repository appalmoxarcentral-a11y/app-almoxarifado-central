-- Corrigir função verificar_senha para resolver erro de login
CREATE OR REPLACE FUNCTION public.verificar_senha(usuario_email TEXT, senha_input TEXT)
RETURNS TABLE(id uuid, nome text, email text, tipo tipo_usuario, permissoes jsonb, ativo boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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