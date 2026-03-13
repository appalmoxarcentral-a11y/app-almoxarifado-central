-- Update Tenant Isolation policies to allow SUPER_ADMIN to see all data
-- This affects all business tables that use tenant_id

DO $$ 
DECLARE 
    t text;
    table_exists boolean;
BEGIN
    -- List of all tables that should be accessible by Super Admin
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'logs_sistema', 'subscription_invoices', 'subscriptions'] LOOP
        
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            -- Drop existing tenant isolation policy
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Users can view invoices of their tenant" ON public.%I', t);
            
            -- Create new policy: 
            -- 1. If Super Admin, can see everything
            -- 2. If not Super Admin, can only see their own tenant_id
            EXECUTE format('CREATE POLICY "Tenant Isolation" ON public.%I USING (
                public.is_super_admin() OR tenant_id = public.get_current_tenant_id()
            )', t);
            
            -- Also allow INSERT/UPDATE/DELETE for Super Admin on all tables
            -- (Most tables already have specific policies, but this ensures Super Admin control)
            EXECUTE format('DROP POLICY IF EXISTS "Super Admin Full Access" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Super Admin Full Access" ON public.%I 
                FOR ALL 
                TO authenticated 
                USING (public.is_super_admin())
                WITH CHECK (public.is_super_admin())', t);

        END IF;
    END LOOP;
END $$;

-- Also update 'tenants' table to allow Super Admin to see all tenants
DROP POLICY IF EXISTS "Super Admin see all tenants" ON public.tenants;
CREATE POLICY "Super Admin see all tenants" ON public.tenants
    FOR ALL USING (public.is_super_admin());

-- Ensure Super Admin can see all profiles
DROP POLICY IF EXISTS "Super Admin see all profiles" ON public.profiles;
CREATE POLICY "Super Admin see all profiles" ON public.profiles
    FOR ALL USING (public.is_super_admin());
