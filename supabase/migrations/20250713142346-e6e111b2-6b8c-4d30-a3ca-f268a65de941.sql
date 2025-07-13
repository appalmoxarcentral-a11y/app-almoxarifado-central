-- Criar tabela para rascunhos de relatórios de compras
CREATE TABLE public.relatorios_compras_rascunho (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  nome_rascunho TEXT NOT NULL,
  data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_atualizacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  finalizado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.relatorios_compras_rascunho ENABLE ROW LEVEL SECURITY;

-- Política para usuários visualizarem apenas seus próprios rascunhos
CREATE POLICY "Usuários podem visualizar seus próprios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR SELECT 
USING (usuario_id::text = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- Política para usuários criarem seus próprios rascunhos
CREATE POLICY "Usuários podem criar seus próprios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR INSERT 
WITH CHECK (usuario_id::text = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- Política para usuários atualizarem seus próprios rascunhos
CREATE POLICY "Usuários podem atualizar seus próprios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR UPDATE 
USING (usuario_id::text = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- Política para usuários excluírem seus próprios rascunhos
CREATE POLICY "Usuários podem excluir seus próprios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR DELETE 
USING (usuario_id::text = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- Função para atualizar timestamp de atualização
CREATE OR REPLACE FUNCTION public.update_relatorio_compras_rascunho_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_atualizacao = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar automaticamente data_atualizacao
CREATE TRIGGER update_relatorios_compras_rascunho_updated_at
  BEFORE UPDATE ON public.relatorios_compras_rascunho
  FOR EACH ROW
  EXECUTE FUNCTION public.update_relatorio_compras_rascunho_updated_at();

-- Índices para melhor performance
CREATE INDEX idx_relatorios_compras_rascunho_usuario_id ON public.relatorios_compras_rascunho(usuario_id);
CREATE INDEX idx_relatorios_compras_rascunho_data_criacao ON public.relatorios_compras_rascunho(data_criacao DESC);