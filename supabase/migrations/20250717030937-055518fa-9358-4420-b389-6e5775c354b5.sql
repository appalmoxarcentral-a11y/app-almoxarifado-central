-- Simplificar todas as políticas RLS para resolver problemas de carregamento de dados

-- ==== REMOVER TODAS AS POLÍTICAS EXISTENTES ====

-- Produtos
DROP POLICY IF EXISTS "Usuários podem ver produtos se têm permissão" ON public.produtos;
DROP POLICY IF EXISTS "Usuários podem criar produtos se têm permissão" ON public.produtos;
DROP POLICY IF EXISTS "Usuários podem atualizar produtos se têm permissão" ON public.produtos;
DROP POLICY IF EXISTS "Usuários podem excluir produtos se têm permissão" ON public.produtos;

-- Pacientes
DROP POLICY IF EXISTS "Usuários podem ver pacientes se têm permissão" ON public.pacientes;
DROP POLICY IF EXISTS "Usuários podem criar pacientes se têm permissão" ON public.pacientes;
DROP POLICY IF EXISTS "Usuários podem atualizar pacientes se têm permissão" ON public.pacientes;
DROP POLICY IF EXISTS "Usuários podem excluir pacientes se têm permissão" ON public.pacientes;

-- Entradas de produtos
DROP POLICY IF EXISTS "Usuários podem ver entradas se têm permissão" ON public.entradas_produtos;
DROP POLICY IF EXISTS "Usuários podem criar entradas se têm permissão" ON public.entradas_produtos;
DROP POLICY IF EXISTS "Usuários podem atualizar entradas se têm permissão" ON public.entradas_produtos;
DROP POLICY IF EXISTS "Usuários podem excluir entradas se têm permissão" ON public.entradas_produtos;

-- Dispensações
DROP POLICY IF EXISTS "Usuários podem ver dispensações se têm permissão" ON public.dispensacoes;
DROP POLICY IF EXISTS "Usuários podem criar dispensações se têm permissão" ON public.dispensacoes;
DROP POLICY IF EXISTS "Usuários podem atualizar dispensações se têm permissão" ON public.dispensacoes;
DROP POLICY IF EXISTS "Usuários podem excluir dispensações se têm permissão" ON public.dispensacoes;

-- Usuários
DROP POLICY IF EXISTS "Admins podem ver todos os usuários" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem criar usuários" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem atualizar usuários" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem excluir usuários" ON public.usuarios;

-- Logs do sistema
DROP POLICY IF EXISTS "Usuários podem ver logs se têm permissão" ON public.logs_sistema;

-- Rascunhos compras (ambas as tabelas)
DROP POLICY IF EXISTS "Usuários podem ver seus rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "Usuários podem criar seus rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "Usuários podem atualizar seus rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "Usuários podem excluir seus rascunhos" ON public.rascunhos_compras;

DROP POLICY IF EXISTS "Usuários podem visualizar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "Usuários podem excluir seus próprios rascunhos" ON public.relatorios_compras_rascunho;

-- ==== CRIAR POLÍTICAS SIMPLES E FUNCIONAIS ====

-- PRODUTOS: Acesso completo para usuários autenticados
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.produtos
FOR ALL USING (auth.uid() IS NOT NULL);

-- PACIENTES: Acesso completo para usuários autenticados
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.pacientes
FOR ALL USING (auth.uid() IS NOT NULL);

-- ENTRADAS DE PRODUTOS: Acesso completo para usuários autenticados
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.entradas_produtos
FOR ALL USING (auth.uid() IS NOT NULL);

-- DISPENSAÇÕES: Acesso completo para usuários autenticados
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.dispensacoes
FOR ALL USING (auth.uid() IS NOT NULL);

-- USUÁRIOS: Acesso completo para usuários autenticados
CREATE POLICY "Permitir acesso completo para usuários autenticados" ON public.usuarios
FOR ALL USING (auth.uid() IS NOT NULL);

-- LOGS DO SISTEMA: Somente leitura para usuários autenticados
CREATE POLICY "Permitir leitura para usuários autenticados" ON public.logs_sistema
FOR SELECT USING (auth.uid() IS NOT NULL);

-- RASCUNHOS COMPRAS: Acesso aos próprios rascunhos usando auth.uid()
CREATE POLICY "Usuários podem gerenciar seus próprios rascunhos" ON public.rascunhos_compras
FOR ALL USING (auth.uid()::text = usuario_id::text);

-- RELATÓRIOS COMPRAS RASCUNHO: Acesso aos próprios rascunhos usando auth.uid()
CREATE POLICY "Usuários podem gerenciar seus próprios rascunhos de relatório" ON public.relatorios_compras_rascunho
FOR ALL USING (auth.uid()::text = usuario_id::text);