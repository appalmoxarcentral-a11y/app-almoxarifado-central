-- Criar nova tabela específica para rascunhos de compras
CREATE TABLE public.rascunhos_compras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  nome_rascunho TEXT NOT NULL,
  dados_produtos JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_atualizacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ativo BOOLEAN NOT NULL DEFAULT true
);

-- Habilitar RLS
ALTER TABLE public.rascunhos_compras ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS usando get_current_user_id()
CREATE POLICY "Usuários podem visualizar seus próprios rascunhos" 
ON public.rascunhos_compras 
FOR SELECT 
USING (usuario_id = public.get_current_user_id());

CREATE POLICY "Usuários podem criar seus próprios rascunhos" 
ON public.rascunhos_compras 
FOR INSERT 
WITH CHECK (usuario_id = public.get_current_user_id());

CREATE POLICY "Usuários podem atualizar seus próprios rascunhos" 
ON public.rascunhos_compras 
FOR UPDATE 
USING (usuario_id = public.get_current_user_id());

CREATE POLICY "Usuários podem excluir seus próprios rascunhos" 
ON public.rascunhos_compras 
FOR DELETE 
USING (usuario_id = public.get_current_user_id());

-- Criar trigger para atualizar data_atualizacao automaticamente
CREATE OR REPLACE FUNCTION public.update_rascunhos_compras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_atualizacao = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rascunhos_compras_updated_at
BEFORE UPDATE ON public.rascunhos_compras
FOR EACH ROW
EXECUTE FUNCTION public.update_rascunhos_compras_updated_at();

-- Migrar dados existentes da tabela antiga (se houver)
INSERT INTO public.rascunhos_compras (usuario_id, nome_rascunho, dados_produtos, data_criacao, data_atualizacao, ativo)
SELECT 
  usuario_id,
  nome_rascunho,
  items as dados_produtos,
  data_criacao,
  data_atualizacao,
  NOT finalizado as ativo
FROM public.relatorios_compras_rascunho
WHERE finalizado = false;