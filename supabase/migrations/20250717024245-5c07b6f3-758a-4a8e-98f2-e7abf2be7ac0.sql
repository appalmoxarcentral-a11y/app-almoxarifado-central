-- Corrigir função hash_senha para usar extensions.digest explicitamente
CREATE OR REPLACE FUNCTION public.hash_senha(senha_texto text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN encode(extensions.digest(senha_texto, 'sha256'), 'hex');
END;
$$;