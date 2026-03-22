
-- Inserir alguns procedimentos globais para garantir que a lista não fique vazia
INSERT INTO public.procedimentos (nome, tenant_id)
VALUES 
  ('CONSULTA MÉDICA', NULL),
  ('CURATIVO', NULL),
  ('DISPENSAÇÃO DE MEDICAMENTOS', NULL),
  ('ADMINISTRAÇÃO DE MEDICAMENTOS', NULL),
  ('NEBULIZAÇÃO', NULL),
  ('RETIRADA DE PONTOS', NULL),
  ('AFERIÇÃO DE PRESSÃO ARTERIAL', NULL),
  ('TESTE DE GLICEMIA', NULL)
ON CONFLICT DO NOTHING;
