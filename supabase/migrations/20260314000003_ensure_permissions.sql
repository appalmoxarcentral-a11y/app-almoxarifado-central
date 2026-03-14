-- Ensure permissions for unidades_saude
GRANT SELECT ON public.unidades_saude TO anon;
GRANT ALL ON public.unidades_saude TO authenticated;

-- Ensure permissions for audit_vinculos_unidade
GRANT ALL ON public.audit_vinculos_unidade TO authenticated;

-- Enable RLS on audit_vinculos_unidade
ALTER TABLE public.audit_vinculos_unidade ENABLE ROW LEVEL SECURITY;

-- Policy for audit_vinculos_unidade: Admins can see all, users see their own changes
CREATE POLICY "Admins can view all audit logs" ON public.audit_vinculos_unidade
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Users can view their own audit logs" ON public.audit_vinculos_unidade
    FOR SELECT USING (usuario_id = auth.uid());

-- Ensure permissions for profiles (already handled but good to be sure)
GRANT ALL ON public.profiles TO authenticated;
