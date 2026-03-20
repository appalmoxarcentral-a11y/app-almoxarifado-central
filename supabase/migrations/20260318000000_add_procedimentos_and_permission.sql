
-- Add permission to units
ALTER TABLE public.unidades_saude ADD COLUMN IF NOT EXISTS usar_tipo_dispensacao BOOLEAN DEFAULT false;

-- Create procedimentos table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for procedimentos
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for procedimentos
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.procedimentos;
    CREATE POLICY "Tenant Isolation" ON public.procedimentos FOR ALL TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());
END $$;

-- Add procedimento column to dispensations
ALTER TABLE public.dispensacoes ADD COLUMN IF NOT EXISTS procedimento TEXT;

-- Index for unique procedures search
CREATE INDEX IF NOT EXISTS idx_procedimentos_nome ON public.procedimentos(nome);
CREATE INDEX IF NOT EXISTS idx_procedimentos_tenant ON public.procedimentos(tenant_id);
