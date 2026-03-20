
-- Add unique constraint to procedures name per tenant
-- First, clean up any existing duplicates (keep only the newest one)
DELETE FROM public.procedimentos a
USING public.procedimentos b
WHERE a.id < b.id
  AND a.nome = b.nome
  AND a.tenant_id = b.tenant_id;

-- Now add the constraint
ALTER TABLE public.procedimentos DROP CONSTRAINT IF EXISTS procedimentos_nome_tenant_key;
ALTER TABLE public.procedimentos ADD CONSTRAINT procedimentos_nome_tenant_key UNIQUE (nome, tenant_id);
