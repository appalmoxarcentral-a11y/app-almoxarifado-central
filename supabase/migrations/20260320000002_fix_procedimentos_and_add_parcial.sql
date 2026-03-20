
-- 1. Create procedimentos table if it doesn't exist (Fixes relation does not exist error)
CREATE TABLE IF NOT EXISTS public.procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Add unique constraint to procedures name per tenant
-- Clean up existing duplicates first
DELETE FROM public.procedimentos a
USING public.procedimentos b
WHERE a.id < b.id
  AND a.nome = b.nome
  AND a.tenant_id = b.tenant_id;

ALTER TABLE public.procedimentos DROP CONSTRAINT IF EXISTS procedimentos_nome_tenant_key;
ALTER TABLE public.procedimentos ADD CONSTRAINT procedimentos_nome_tenant_key UNIQUE (nome, tenant_id);

-- 3. Add columns to dispensacoes table
ALTER TABLE public.dispensacoes ADD COLUMN IF NOT EXISTS procedimento TEXT;
ALTER TABLE public.dispensacoes ADD COLUMN IF NOT EXISTS is_parcial BOOLEAN DEFAULT false;

-- 4. Enable RLS for procedimentos
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS policy for procedimentos
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.procedimentos;
    CREATE POLICY "Tenant Isolation" ON public.procedimentos FOR ALL TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());
END $$;
