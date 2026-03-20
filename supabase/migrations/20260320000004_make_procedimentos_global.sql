
-- 1. Remove tenant_id from procedimentos to make it global
-- First, handle existing data: Keep one of each procedure name
DELETE FROM public.procedimentos a
USING public.procedimentos b
WHERE a.id < b.id
  AND a.nome = b.nome;

-- Remove tenant_id column
ALTER TABLE public.procedimentos DROP COLUMN IF EXISTS tenant_id CASCADE;

-- Re-add unique constraint on name only
ALTER TABLE public.procedimentos DROP CONSTRAINT IF EXISTS procedimentos_nome_tenant_key;
ALTER TABLE public.procedimentos DROP CONSTRAINT IF EXISTS procedimentos_nome_key;
ALTER TABLE public.procedimentos ADD CONSTRAINT procedimentos_nome_key UNIQUE (nome);

-- 2. Update RLS for global access (all authenticated users can read and insert)
ALTER TABLE public.procedimentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON public.procedimentos;
DROP POLICY IF EXISTS "Global Read" ON public.procedimentos;
DROP POLICY IF EXISTS "Authenticated Insert" ON public.procedimentos;

CREATE POLICY "Global Read" ON public.procedimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated Insert" ON public.procedimentos FOR INSERT TO authenticated WITH CHECK (true);
