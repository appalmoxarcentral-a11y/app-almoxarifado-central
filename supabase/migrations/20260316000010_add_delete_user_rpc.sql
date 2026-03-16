-- Migration to allow admins to delete users
CREATE OR REPLACE FUNCTION public.delete_user(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_caller_role TEXT;
    v_target_role TEXT;
BEGIN
    -- Get the role of the caller
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    
    -- Get the role of the target user
    SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;

    -- Check if the current user is an admin or super admin
    IF v_caller_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores podem excluir usuários.';
    END IF;

    -- Prevent deleting yourself
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Você não pode excluir sua própria conta através deste painel.';
    END IF;

    -- Super Admin can delete anyone (except themselves)
    -- Admin can only delete 'user' (COMUM), not other admins or super admins
    IF v_caller_role = 'admin' AND v_target_role IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Acesso negado: Administradores não podem excluir outros administradores.';
    END IF;

    -- Delete related audit records first to satisfy foreign key constraints
    DELETE FROM public.audit_vinculos_unidade WHERE usuario_id = p_user_id;
    DELETE FROM public.audit_vinculos_unidade WHERE admin_id = p_user_id;

    -- Delete from auth.users (cascades to public.profiles)
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
