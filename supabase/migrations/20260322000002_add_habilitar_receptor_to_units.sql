
-- Migration: Add habilitar_receptor to unidades_saude
ALTER TABLE public.unidades_saude ADD COLUMN IF NOT EXISTS habilitar_receptor BOOLEAN DEFAULT false;

-- Add comment to column
COMMENT ON COLUMN public.unidades_saude.habilitar_receptor IS 'Indica se a unidade pode distinguir entre dispensação para paciente comum ou receptor (servidor)';

-- Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
