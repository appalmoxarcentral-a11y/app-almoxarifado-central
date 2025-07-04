
-- Adicionar constraint de unicidade para código de produto
ALTER TABLE public.produtos ADD CONSTRAINT produtos_codigo_unique UNIQUE (codigo);

-- Adicionar constraint de unicidade para SUS/CPF de paciente
ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_sus_cpf_unique UNIQUE (sus_cpf);

-- Criar índices para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_unique ON public.produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_pacientes_sus_cpf_unique ON public.pacientes(sus_cpf);
