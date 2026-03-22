
-- Migration: Add tenant_id to procedimentos and configure RLS
-- Purpose: Allow multi-tenant support for procedures

-- 1. Add tenant_id column
ALTER TABLE public.procedimentos 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 2. Enable RLS
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies (Global within tenant)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'procedimentos_tenant_access' AND tablename = 'procedimentos') THEN
        CREATE POLICY procedimentos_tenant_access ON public.procedimentos
        FOR ALL 
        USING (tenant_id = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'tenant_id')
        WITH CHECK (tenant_id = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'tenant_id');
    END IF;
END $$;

-- 4. Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
