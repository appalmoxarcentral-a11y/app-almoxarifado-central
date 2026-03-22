-- Migration to create sectors table for health workers
CREATE TABLE IF NOT EXISTS public.setores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add unique constraint to sectors name per tenant
ALTER TABLE public.setores DROP CONSTRAINT IF EXISTS setores_nome_tenant_key;
ALTER TABLE public.setores ADD CONSTRAINT setores_nome_tenant_key UNIQUE (nome, tenant_id);

-- Enable RLS for setores
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for setores
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.setores;
    CREATE POLICY "Tenant Isolation" ON public.setores FOR ALL TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());
END $$;

-- Insert some common sectors for a default tenant (if applicable) or as a starting point
-- (Note: Usually we'd let users add them, but having some defaults is helpful)
-- This assumes tenant_id '00000000-0000-0000-0000-000000000000' is a global or default one if it exists
INSERT INTO public.setores (nome, tenant_id)
SELECT s, t.id FROM (VALUES 
    ('Almoxarifado'), 
    ('Recepção'), 
    ('Enfermagem'), 
    ('Farmácia'), 
    ('Administração'), 
    ('Limpeza'), 
    ('Cozinha'), 
    ('Triagem')
) as sectors(s)
CROSS JOIN public.tenants t
ON CONFLICT DO NOTHING;
