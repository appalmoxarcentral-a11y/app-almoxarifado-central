-- Corrigir políticas RLS para usar auth.uid() diretamente
-- Removendo dependência da função get_current_user_id() que está causando problemas

-- Recriar políticas para relatorios_compras_rascunho usando auth.uid()
DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem excluir seus próprios rascunhos" ON public.relatorios_compras_rascunho;

-- Criar políticas simplificadas usando auth.uid() diretamente
CREATE POLICY "Usuários podem visualizar seus próprios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR SELECT 
USING (usuario_id = auth.uid());

CREATE POLICY "Usuários podem criar seus próprios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR INSERT 
WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Usuários podem atualizar seus próprios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR UPDATE 
USING (usuario_id = auth.uid());

CREATE POLICY "Usuários podem excluir seus próprios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR DELETE 
USING (usuario_id = auth.uid());