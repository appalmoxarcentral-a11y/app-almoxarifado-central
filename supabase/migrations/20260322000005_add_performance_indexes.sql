
-- Migration: Add composite indexes for performance optimization
-- Table: pacientes
-- Purpose: Optimize filtered queries by tenant and health worker status

-- Ensure pg_trgm extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pacientes_tenant_health_worker 
ON public.pacientes (tenant_id, is_health_worker);

-- Additional index for searching by name and SUS/CPF
CREATE INDEX IF NOT EXISTS idx_pacientes_nome_sus_trgm 
ON public.pacientes USING gin (nome gin_trgm_ops, sus_cpf gin_trgm_ops)
WHERE tenant_id IS NOT NULL;
