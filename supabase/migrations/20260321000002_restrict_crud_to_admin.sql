
-- Update RLS for procedimentos and setores to restrict CRUD to admin/super_admin
-- Select is still available for all authenticated users

-- Procedimentos
DROP POLICY IF EXISTS "Global Read" ON public.procedimentos;
DROP POLICY IF EXISTS "Authenticated Insert" ON public.procedimentos;
DROP POLICY IF EXISTS "Admin CRUD" ON public.procedimentos;

CREATE POLICY "Global Read" ON public.procedimentos FOR SELECT TO authenticated USING (true);

-- Allow INSERT, UPDATE, DELETE only for admin or super_admin
CREATE POLICY "Admin CRUD" ON public.procedimentos FOR ALL TO authenticated 
USING (public.is_super_admin() OR public.get_auth_role() = 'admin')
WITH CHECK (public.is_super_admin() OR public.get_auth_role() = 'admin');

-- Setores
DROP POLICY IF EXISTS "Tenant Isolation" ON public.setores;
DROP POLICY IF EXISTS "Setores Read" ON public.setores;
DROP POLICY IF EXISTS "Admin CRUD" ON public.setores;

CREATE POLICY "Setores Read" ON public.setores FOR SELECT TO authenticated 
USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());

-- Allow INSERT, UPDATE, DELETE only for admin or super_admin (within their tenant)
CREATE POLICY "Admin CRUD" ON public.setores FOR ALL TO authenticated 
USING (public.is_super_admin() OR (tenant_id = public.get_current_tenant_id() AND public.get_auth_role() = 'admin'))
WITH CHECK (public.is_super_admin() OR (tenant_id = public.get_current_tenant_id() AND public.get_auth_role() = 'admin'));
