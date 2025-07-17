-- Corrigir funções RLS para usar prefixo public. explicitamente

-- Corrigir get_current_user_permissions para usar public.get_current_user_id()
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    user_perms JSONB;
BEGIN
    SELECT permissoes INTO user_perms
    FROM public.usuarios 
    WHERE id = public.get_current_user_id() AND ativo = true;
    
    RETURN COALESCE(user_perms, '{}'::jsonb);
END;
$$;

-- Corrigir has_permission para usar public.get_current_user_permissions()
CREATE OR REPLACE FUNCTION public.has_permission(perm_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    user_perms JSONB;
BEGIN
    user_perms := public.get_current_user_permissions();
    RETURN COALESCE((user_perms ->> perm_name)::boolean, false);
END;
$$;

-- Corrigir is_admin para usar public.get_current_user_id()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    user_type TEXT;
BEGIN
    SELECT tipo INTO user_type
    FROM public.usuarios 
    WHERE id = public.get_current_user_id() AND ativo = true;
    
    RETURN user_type = 'ADMIN';
END;
$$;