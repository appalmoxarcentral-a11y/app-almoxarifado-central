-- Migration to add health worker information and ensure unity isolation to patients
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS is_health_worker BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sector TEXT,
ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades_saude(id);

-- Update existing records to have is_health_worker as false
UPDATE public.pacientes SET is_health_worker = FALSE WHERE is_health_worker IS NULL;
