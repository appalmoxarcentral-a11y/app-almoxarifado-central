-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Plans table
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    max_users INTEGER NOT NULL,
    max_products INTEGER, -- NULL means unlimited
    features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default plans if not exists
INSERT INTO public.plans (name, description, price, max_users, max_products, features)
SELECT 'Básico', 'Ideal para pequenas unidades', 99.00, 5, 500, '["gestao_estoque", "dispensacao_basica"]'
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'Básico');

INSERT INTO public.plans (name, description, price, max_users, max_products, features)
SELECT 'Profissional', 'Para unidades em crescimento', 199.00, 20, 2000, '["gestao_estoque", "dispensacao_completa", "relatorios_avancados"]'
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'Profissional');

INSERT INTO public.plans (name, description, price, max_users, max_products, features)
SELECT 'Empresarial', 'Sem limites para grandes redes', 499.00, 100, NULL, '["tudo_ilimitado", "suporte_prioritario", "api_acess"]'
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'Empresarial');

-- 2. Create Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    document TEXT, -- CNPJ or similar
    slug TEXT UNIQUE NOT NULL, -- For subdomain or URL identification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create the initial Legacy Tenant for existing data
INSERT INTO public.tenants (id, name, slug, document)
VALUES ('00000000-0000-0000-0000-000000000000', 'Minha Empresa (Legado)', 'legacy', '00000000000')
ON CONFLICT (id) DO NOTHING;

-- 3. Create Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
    plan_id UUID REFERENCES public.plans(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, canceled, past_due, trialing
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create subscription for legacy tenant (Free/Enterprise forever)
INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
SELECT 
    '00000000-0000-0000-0000-000000000000',
    id,
    'active',
    now(),
    now() + interval '100 years'
FROM public.plans WHERE name = 'Empresarial'
AND NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE tenant_id = '00000000-0000-0000-0000-000000000000')
LIMIT 1;

-- 4. Create Profiles table (Links Auth Users to Tenants)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user', -- admin, user, viewer
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Add tenant_id to existing tables (SAFE MODE)
DO $$ 
DECLARE 
    legacy_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
    t text;
    table_exists boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'logs_sistema', 'usuarios'] LOOP
        
        -- Check if table exists in public schema
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            RAISE NOTICE 'Migrating table: %', t;
            
            -- Add column if not exists
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)', t);
            
            -- Update existing rows to belong to legacy tenant
            EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t, legacy_tenant_id);
            
            -- Alter column to be NOT NULL (after update)
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
            
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        ELSE
            RAISE NOTICE 'Table % does not exist in public schema, skipping migration for this table.', t;
        END IF;
    END LOOP;
END $$;

-- 6. RLS Policies

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply policies to Tenants
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" ON public.tenants
    FOR SELECT USING (id = public.get_current_tenant_id());

-- Apply policies to Profiles
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
CREATE POLICY "Users can view profiles in their tenant" ON public.profiles
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());
    
DROP POLICY IF EXISTS "Admins can edit profiles in their tenant" ON public.profiles;
CREATE POLICY "Admins can edit profiles in their tenant" ON public.profiles
    FOR UPDATE USING (
        tenant_id = public.get_current_tenant_id() AND 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Apply policies to Business Tables (SAFE MODE)
DO $$ 
DECLARE 
    t text;
    table_exists boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'logs_sistema'] LOOP
        
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Tenant Isolation" ON public.%I USING (tenant_id = public.get_current_tenant_id())', t);
        END IF;
    END LOOP;
END $$;

-- Special handling for 'usuarios' table (Legacy custom auth table)
-- We keep it for reference but it should be deprecated in favor of 'profiles'
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios') THEN
        ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- Trigger to create Profile on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        (new.raw_user_meta_data->>'tenant_id')::uuid,
        COALESCE(new.raw_user_meta_data->>'role', 'user')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
