
-- Criar tabela para gerenciar unidades de medida dinamicamente
CREATE TABLE public.unidades_medida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(10) UNIQUE NOT NULL,
  descricao TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.usuarios(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir unidades de medida existentes
INSERT INTO public.unidades_medida (codigo, descricao) VALUES
('AM', 'Ampola (AM)'),
('CP', 'Comprimido (CP)'),
('BG', 'Bisnaga (BG)'),
('FR', 'Frasco (FR)'),
('CPS', 'Cápsula (CPS)'),
('ML', 'Mililitro (ML)'),
('MG', 'Miligrama (MG)'),
('G', 'Grama (G)'),
('KG', 'Quilograma (KG)'),
('UN', 'Unidade (UN)');

-- Criar índices para otimização
CREATE INDEX idx_unidades_medida_codigo ON public.unidades_medida(codigo);
CREATE INDEX idx_unidades_medida_ativo ON public.unidades_medida(ativo);
