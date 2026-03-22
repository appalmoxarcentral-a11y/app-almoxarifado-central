
-- Update RLS for procedimentos, setores and unidades_medida to allow CRUD for all authenticated users
-- As requested by the user: "A parte de crud de add e edição, deve ser liberada para o usuario comum"

-- Procedimentos
DROP POLICY IF EXISTS "Global Read" ON public.procedimentos;
DROP POLICY IF EXISTS "Admin CRUD" ON public.procedimentos;

CREATE POLICY "Allow All Authenticated CRUD" ON public.procedimentos FOR ALL TO authenticated 
USING (true)
WITH CHECK (true);

-- Setores
DROP POLICY IF EXISTS "Setores Read" ON public.setores;
DROP POLICY IF EXISTS "Admin CRUD" ON public.setores;

CREATE POLICY "Allow All Authenticated CRUD" ON public.setores FOR ALL TO authenticated 
USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id())
WITH CHECK (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());

-- Unidades de Medida
ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Unidades Medida CRUD" ON public.unidades_medida;

CREATE POLICY "Allow All Authenticated CRUD" ON public.unidades_medida FOR ALL TO authenticated 
USING (true)
WITH CHECK (true);
