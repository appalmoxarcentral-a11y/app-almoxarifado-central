-- Atualizar função para definir o ID do usuário atual na sessão (ao invés de transação)
CREATE OR REPLACE FUNCTION public.set_current_user_id(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Usar 'true' para persistir na sessão ao invés de apenas na transação
  PERFORM set_config('app.current_user_id', user_id_param::text, true);
END;
$$;