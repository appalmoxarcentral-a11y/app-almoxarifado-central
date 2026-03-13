-- Fix RLS policies for all business tables to handle multi-tenancy and Super Admins correctly
-- This ensures that both regular users (isolated by tenant) and Super Admins (global access)
-- can perform operations without RLS violations.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'logs_sistema'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists in public schema
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) THEN
            -- Drop old policy if exists
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            
            -- Create new robust policy
            EXECUTE format('
                CREATE POLICY "Tenant Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id())
                WITH CHECK (public.is_super_admin() OR tenant_id = public.get_current_tenant_id())
            ', t);
            
            RAISE NOTICE 'Updated RLS policy for table: %', t;
        END IF;
    END LOOP;
END $$;
