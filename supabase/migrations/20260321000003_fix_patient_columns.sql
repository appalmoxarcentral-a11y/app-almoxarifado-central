
-- Migration to add health worker information to patients
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pacientes' AND column_name='is_health_worker') THEN
        ALTER TABLE public.pacientes ADD COLUMN is_health_worker BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pacientes' AND column_name='sector') THEN
        ALTER TABLE public.pacientes ADD COLUMN sector TEXT;
    END IF;
END $$;

-- Update existing records
UPDATE public.pacientes SET is_health_worker = FALSE WHERE is_health_worker IS NULL;
