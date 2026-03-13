-- Fix Admin and Super Admin access to all tenant data (entradas, dispensacoes, rascunhos)
-- This ensures that Admins can view and manage data from all users within their own tenant,
-- and Super Admins can manage data across all tenants.
-- This fix allows "Modo de Acesso Rápido" (impersonation) to work correctly at the database level.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY['entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'relatorios_compras_rascunho'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Drop existing User Isolation or restrictive policies
            EXECUTE format('DROP POLICY IF EXISTS "User Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios rascunhos" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios rascunhos de relatório" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Admin and User Isolation" ON public.%I', t);
            
            -- Create new robust policy:
            -- 1. Super Admin: Global access
            -- 2. Admin: Full access to all data in their tenant
            -- 3. Common User: Access only to their own data in their tenant
            EXECUTE format('
                CREATE POLICY "Admin and User Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.get_auth_role() = ''admin'' OR usuario_id = auth.uid())
                    )
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.get_auth_role() = ''admin'' OR usuario_id = auth.uid())
                    )
                )
            ', t);
            
            RAISE NOTICE 'Updated RLS policy for table: %', t;
        END IF;
    END LOOP;
END $$;
