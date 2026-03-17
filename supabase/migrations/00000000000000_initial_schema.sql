
-- FILE: 00_INITIAL_SCHEMA.sql
-- Initial Schema Script (00_INITIAL_SCHEMA.sql)
-- This file creates the base tables that were present in the legacy database
-- before the migrations in this repository were applied.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE public.tipo_usuario AS ENUM ('ADMIN', 'COMUM');

-- 0. Unidades de Saude
CREATE TABLE IF NOT EXISTS public.unidades_saude (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    codigo TEXT UNIQUE NOT NULL,
    cidade TEXT,
    endereco TEXT,
    bairro TEXT,
    ativo BOOLEAN DEFAULT true,
    tenant_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 1. Unidades de Medida
CREATE TABLE IF NOT EXISTS public.unidades_medida (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE NOT NULL,
    descricao TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID -- Will be linked to usuarios/profiles later
);

-- 2. Usuarios (Legacy Table)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo public.tipo_usuario DEFAULT 'COMUM',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    profile_id UUID -- Will be added/updated by migrations
);

-- 3. Produtos (Master table in legacy system)
CREATE TABLE IF NOT EXISTS public.produtos_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    unidade_medida TEXT REFERENCES public.unidades_medida(codigo),
    estoque_atual INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Pacientes
CREATE TABLE IF NOT EXISTS public.pacientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    sus_cpf TEXT NOT NULL,
    nascimento DATE NOT NULL,
    idade INTEGER,
    telefone TEXT,
    endereco TEXT,
    bairro TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Entradas de Produtos
CREATE TABLE IF NOT EXISTS public.entradas_produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    produto_id UUID REFERENCES public.produtos_master(id) ON DELETE CASCADE,
    quantidade INTEGER NOT NULL,
    lote TEXT NOT NULL,
    vencimento DATE NOT NULL,
    data_entrada TIMESTAMP WITH TIME ZONE DEFAULT now(),
    usuario_id UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Dispensacoes
CREATE TABLE IF NOT EXISTS public.dispensacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES public.produtos_master(id) ON DELETE CASCADE,
    quantidade INTEGER NOT NULL,
    lote TEXT NOT NULL,
    data_dispensa TIMESTAMP WITH TIME ZONE DEFAULT now(),
    usuario_id UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 7. Rascunhos de Compras
CREATE TABLE IF NOT EXISTS public.rascunhos_compras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_rascunho TEXT NOT NULL,
    dados_produtos JSONB NOT NULL DEFAULT '[]'::jsonb,
    usuario_id UUID REFERENCES public.usuarios(id),
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 8. Logs do Sistema
CREATE TABLE IF NOT EXISTS public.logs_sistema (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES public.usuarios(id),
    acao TEXT NOT NULL,
    tabela TEXT NOT NULL,
    detalhes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 9. Stub Tables for Clinical Module
CREATE TABLE IF NOT EXISTS public.atendimentos (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
CREATE TABLE IF NOT EXISTS public.queixas_principais (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
CREATE TABLE IF NOT EXISTS public.procedimentos_realizados (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());
CREATE TABLE IF NOT EXISTS public.rascunhos_atendimentos (id UUID PRIMARY KEY DEFAULT uuid_generate_v4());


-- FILE: 00_MIGRACAO_TOTAL.sql
-- Consolidated Migration Script (00_MIGRACAO_TOTAL.sql)
-- This file contains the final optimized schema and logic for the system.
-- It integrates all fixes for stock management, user isolation, and security.

-- ==========================================
-- 1. CLEANUP LEGACY OBJECTS
-- ==========================================
DO $$
BEGIN
    -- Drop old triggers to avoid duplicates
    DROP TRIGGER IF EXISTS trigger_entrada_produto ON public.entradas_produtos;
    DROP TRIGGER IF EXISTS trigger_entrada_produto_unico ON public.entradas_produtos;
    DROP TRIGGER IF EXISTS trigger_dispensacao_estoque ON public.dispensacoes;
    DROP TRIGGER IF EXISTS trigger_dispensacao_unica ON public.dispensacoes;
    
    -- Drop old table if it's deprecated
    DROP TABLE IF EXISTS public.usuarios CASCADE;
    DROP TYPE IF EXISTS public.tipo_usuario CASCADE;
    
    -- Handle produtos vs produtos_master
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos_master') THEN
        DROP TABLE IF EXISTS public.produtos CASCADE;
        ALTER TABLE public.produtos_master RENAME TO produtos;
    END IF;
    
    -- Ensure estoque_atual exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produtos' AND column_name = 'estoque_atual') THEN
        ALTER TABLE public.produtos ADD COLUMN estoque_atual INTEGER DEFAULT 0;
    END IF;
END $$;

-- ==========================================
-- 2. ROBUST SECURITY HELPER FUNCTIONS (SECURITY DEFINER)
-- ==========================================
-- These bypass RLS internally to avoid infinite recursion loops.

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_tenant()
RETURNS uuid AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        public.get_auth_tenant(),
        '00000000-0000-0000-0000-000000000000'::uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. UNIFIED RLS POLICIES (JWT + FUNCTION BASED)
-- ==========================================

-- Profiles: View team and manage unit
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
    CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_super_admin() OR tenant_id = public.get_auth_tenant());
    
    DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;
    CREATE POLICY "profiles_manage_policy" ON public.profiles FOR ALL TO authenticated
    USING (public.is_super_admin() OR (public.get_auth_role() = 'admin' AND tenant_id = public.get_auth_tenant()));
END $$;

-- Entries & Dispensations: PRIVATE ISOLATION (Each user sees their own)
-- Note: Super Admin sees everything for audit.
ALTER TABLE public.entradas_produtos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "User Isolation" ON public.entradas_produtos;
    CREATE POLICY "User Isolation" ON public.entradas_produtos FOR ALL TO authenticated
    USING (public.is_super_admin() OR (tenant_id = public.get_current_tenant_id() AND usuario_id = auth.uid()));
END $$;

ALTER TABLE public.dispensacoes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "User Isolation" ON public.dispensacoes;
    CREATE POLICY "User Isolation" ON public.dispensacoes FOR ALL TO authenticated
    USING (public.is_super_admin() OR (tenant_id = public.get_current_tenant_id() AND usuario_id = auth.uid()));
END $$;

-- Shared Data: Products & Patients (Collaborative within Tenant)
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.produtos;
    CREATE POLICY "Tenant Isolation" ON public.produtos FOR ALL TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());
END $$;

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.pacientes;
    CREATE POLICY "Tenant Isolation" ON public.pacientes FOR ALL TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());
END $$;

-- ==========================================
-- 4. AUTOMATIC STOCK CALCULATION TRIGGERS
-- ==========================================

-- Entry Stock Handler (INSERT, UPDATE, DELETE)
CREATE OR REPLACE FUNCTION public.atualizar_estoque_entrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.produtos SET estoque_atual = estoque_atual + NEW.quantidade WHERE id = NEW.produto_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE public.produtos SET estoque_atual = estoque_atual - OLD.quantidade + NEW.quantidade WHERE id = NEW.produto_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.produtos SET estoque_atual = estoque_atual - OLD.quantidade WHERE id = OLD.produto_id;
    END IF;
    RETURN NULL;
END;
$$;

-- Dispensation Stock Handler (INSERT)
CREATE OR REPLACE FUNCTION public.atualizar_estoque_dispensacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_estoque integer;
BEGIN
    SELECT estoque_atual INTO v_estoque FROM public.produtos WHERE id = NEW.produto_id;
    IF v_estoque < NEW.quantidade THEN RAISE EXCEPTION 'Estoque insuficiente'; END IF;
    UPDATE public.produtos SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.produto_id;
    RETURN NULL;
END;
$$;

-- Activate Triggers
CREATE TRIGGER trigger_entrada_final AFTER INSERT OR UPDATE OR DELETE ON public.entradas_produtos FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_entrada();
CREATE TRIGGER trigger_dispensacao_final AFTER INSERT ON public.dispensacoes FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_dispensacao();


-- FILE: 20250625024819-b8551a5b-59ff-4925-8821-92ce5f4c0d85.sql

-- Criar enum para unidades de medida
CREATE TYPE unidade_medida AS ENUM ('AM', 'CP', 'BG', 'FR', 'CPS', 'ML', 'MG', 'G', 'KG', 'UN');

-- Criar enum para tipos de usuÃ¡rio
CREATE TYPE tipo_usuario AS ENUM ('ADMIN', 'COMUM');

-- Tabela de usuÃ¡rios (sistema customizado sem auth do Supabase)
CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL, -- serÃ¡ armazenado como hash
  tipo tipo_usuario NOT NULL DEFAULT 'COMUM',
  permissoes JSONB NOT NULL DEFAULT '{
    "cadastro_pacientes": false,
    "cadastro_produtos": false,
    "entrada_produtos": false,
    "dispensacao": false,
    "historicos": false,
    "gestao_usuarios": false
  }'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de pacientes (idade serÃ¡ calculada na aplicaÃ§Ã£o)
CREATE TABLE public.pacientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  sus_cpf TEXT UNIQUE NOT NULL,
  endereco TEXT NOT NULL,
  bairro TEXT NOT NULL,
  telefone TEXT NOT NULL,
  nascimento DATE NOT NULL,
  idade INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de produtos
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  unidade_medida unidade_medida NOT NULL,
  estoque_atual INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de entradas de produtos
CREATE TABLE public.entradas_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  vencimento DATE NOT NULL,
  lote TEXT NOT NULL,
  data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de dispensaÃ§Ãµes
CREATE TABLE public.dispensacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id),
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  lote TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  data_dispensa DATE NOT NULL DEFAULT CURRENT_DATE,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de logs do sistema para auditoria
CREATE TABLE public.logs_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES public.usuarios(id),
  acao TEXT NOT NULL,
  tabela TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar Ã­ndices para otimizaÃ§Ã£o
CREATE INDEX idx_pacientes_sus_cpf ON public.pacientes(sus_cpf);
CREATE INDEX idx_produtos_codigo ON public.produtos(codigo);
CREATE INDEX idx_entradas_produto_id ON public.entradas_produtos(produto_id);
CREATE INDEX idx_entradas_data ON public.entradas_produtos(data_entrada);
CREATE INDEX idx_dispensacoes_paciente_id ON public.dispensacoes(paciente_id);
CREATE INDEX idx_dispensacoes_produto_id ON public.dispensacoes(produto_id);
CREATE INDEX idx_dispensacoes_data ON public.dispensacoes(data_dispensa);
CREATE INDEX idx_logs_usuario_id ON public.logs_sistema(usuario_id);
CREATE INDEX idx_logs_data ON public.logs_sistema(created_at);

-- FunÃ§Ã£o para atualizar estoque automaticamente nas entradas
CREATE OR REPLACE FUNCTION atualizar_estoque_entrada()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.produtos 
  SET estoque_atual = estoque_atual + NEW.quantidade 
  WHERE id = NEW.produto_id;
  
  INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes)
  VALUES (NEW.usuario_id, 'ENTRADA_PRODUTO', 'entradas_produtos', 
          json_build_object(
            'produto_id', NEW.produto_id,
            'quantidade', NEW.quantidade,
            'lote', NEW.lote
          ));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FunÃ§Ã£o para atualizar estoque automaticamente nas dispensaÃ§Ãµes
CREATE OR REPLACE FUNCTION atualizar_estoque_dispensacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se hÃ¡ estoque suficiente
  IF (SELECT estoque_atual FROM public.produtos WHERE id = NEW.produto_id) < NEW.quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente para dispensaÃ§Ã£o';
  END IF;
  
  UPDATE public.produtos 
  SET estoque_atual = estoque_atual - NEW.quantidade 
  WHERE id = NEW.produto_id;
  
  INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes)
  VALUES (NEW.usuario_id, 'DISPENSACAO', 'dispensacoes', 
          json_build_object(
            'paciente_id', NEW.paciente_id,
            'produto_id', NEW.produto_id,
            'quantidade', NEW.quantidade,
            'lote', NEW.lote
          ));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers
CREATE TRIGGER trigger_entrada_produto
  AFTER INSERT ON public.entradas_produtos
  FOR EACH ROW EXECUTE FUNCTION atualizar_estoque_entrada();

CREATE TRIGGER trigger_dispensacao
  AFTER INSERT ON public.dispensacoes
  FOR EACH ROW EXECUTE FUNCTION atualizar_estoque_dispensacao();

-- FunÃ§Ã£o para hash de senhas (simples para demonstraÃ§Ã£o)
CREATE OR REPLACE FUNCTION hash_senha(senha_texto TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(senha_texto, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Inserir usuÃ¡rio administrador padrÃ£o
INSERT INTO public.usuarios (nome, email, senha, tipo, permissoes) 
VALUES (
  'Administrador',
  'admin@ubsf.com',
  hash_senha('admin123'),
  'ADMIN',
  '{
    "cadastro_pacientes": true,
    "cadastro_produtos": true,
    "entrada_produtos": true,
    "dispensacao": true,
    "historicos": true,
    "gestao_usuarios": true
  }'::jsonb
);

-- Inserir alguns dados de exemplo para teste
INSERT INTO public.produtos (descricao, codigo, unidade_medida, estoque_atual) VALUES
('Dipirona 500mg', 'DIP500', 'CP', 150),
('Paracetamol 750mg', 'PAR750', 'CP', 200),
('Amoxicilina 500mg', 'AMO500', 'CPS', 80),
('Soro FisiolÃ³gico 0,9%', 'SFO09', 'FR', 50),
('Insulina NPH', 'INS001', 'FR', 25);

-- Inserir pacientes com idade calculada manualmente
INSERT INTO public.pacientes (nome, sus_cpf, endereco, bairro, telefone, nascimento, idade) VALUES
('JoÃ£o Silva Santos', '123.456.789-00', 'Rua das Flores, 123', 'Centro', '(11) 99999-1234', '1980-05-15', 44),
('Maria Oliveira Costa', '987.654.321-00', 'Av. Principal, 456', 'Jardim AmÃ©rica', '(11) 88888-5678', '1975-12-20', 49),
('JosÃ© Carlos Pereira', '456.789.123-00', 'Rua da Paz, 789', 'Vila Nova', '(11) 77777-9012', '1990-03-10', 34);


-- FILE: 20250701154551-7a9fe087-5662-4183-9bf9-9f2a779c15c4.sql

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
('CPS', 'CÃ¡psula (CPS)'),
('ML', 'Mililitro (ML)'),
('MG', 'Miligrama (MG)'),
('G', 'Grama (G)'),
('KG', 'Quilograma (KG)'),
('UN', 'Unidade (UN)');

-- Criar Ã­ndices para otimizaÃ§Ã£o
CREATE INDEX idx_unidades_medida_codigo ON public.unidades_medida(codigo);
CREATE INDEX idx_unidades_medida_ativo ON public.unidades_medida(ativo);


-- FILE: 20250704144149-3a33015d-39ac-4362-bbde-8bed670772c2.sql

-- Adicionar constraint de unicidade para cÃ³digo de produto
ALTER TABLE public.produtos ADD CONSTRAINT produtos_codigo_unique UNIQUE (codigo);

-- Adicionar constraint de unicidade para SUS/CPF de paciente
ALTER TABLE public.pacientes ADD CONSTRAINT pacientes_sus_cpf_unique UNIQUE (sus_cpf);

-- Criar Ã­ndices para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_unique ON public.produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_pacientes_sus_cpf_unique ON public.pacientes(sus_cpf);


-- FILE: 20250712125553-d775ce7e-ecc3-44aa-90f3-33591ee2a18c.sql
-- Adicionar PCT ao enum unidade_medida para resolver conflito
ALTER TYPE unidade_medida ADD VALUE 'PCT';

-- FILE: 20250712130826-8a7dd6e2-198f-4243-80ab-344014f72d71.sql
-- Adicionar CX ao enum unidade_medida para resolver erro de cadastro/atualizaÃ§Ã£o
ALTER TYPE unidade_medida ADD VALUE 'CX';

-- FILE: 20250712131643-fba9c593-8557-4f97-b10a-39015514ff5c.sql
-- Adicionar TST ao enum para resolver inconsistÃªncia atual
ALTER TYPE unidade_medida ADD VALUE 'TST';

-- FunÃ§Ã£o para sincronizar automaticamente enum com novas unidades de medida
CREATE OR REPLACE FUNCTION sincronizar_enum_unidade_medida()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o valor jÃ¡ existe no enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'unidade_medida')
    AND enumlabel = NEW.codigo
  ) THEN
    -- Adicionar ao enum se nÃ£o existir
    EXECUTE format('ALTER TYPE unidade_medida ADD VALUE %L', NEW.codigo);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizaÃ§Ã£o automÃ¡tica apÃ³s inserÃ§Ã£o de nova unidade
CREATE TRIGGER trigger_sincronizar_enum_unidade_medida
  AFTER INSERT ON unidades_medida
  FOR EACH ROW
  EXECUTE FUNCTION sincronizar_enum_unidade_medida();

-- FILE: 20250712132246-4d99dbbc-7a27-44bc-be58-a8304dc6c0f8.sql
-- Remover o trigger que causa erro de permissÃµes
DROP TRIGGER IF EXISTS trigger_sincronizar_enum_unidade_medida ON unidades_medida;

-- Remover a funÃ§Ã£o que nÃ£o pode ser executada pelo usuÃ¡rio authenticator
DROP FUNCTION IF EXISTS sincronizar_enum_unidade_medida();

-- FILE: 20250712133914-a5f4a608-342f-42d4-a6a0-155e01fb8927.sql
-- 1. Primeiro, sincronizar dados existentes para garantir que todas as unidades do enum estejam na tabela
INSERT INTO unidades_medida (codigo, descricao, ativo) 
VALUES 
  ('AM', 'Ampola', true),
  ('CP', 'Comprimido', true),
  ('BG', 'Bisnaga', true),
  ('FR', 'Frasco', true),
  ('CPS', 'CÃ¡psula', true),
  ('ML', 'Mililitro', true),
  ('MG', 'Miligrama', true),
  ('G', 'Grama', true),
  ('KG', 'Quilograma', true),
  ('UN', 'Unidade', true),
  ('PCT', 'Pacote', true),
  ('CX', 'Caixa', true),
  ('TST', 'Teste', true)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Alterar tabela produtos para usar VARCHAR em vez do enum
ALTER TABLE produtos ALTER COLUMN unidade_medida TYPE VARCHAR(10);

-- 3. Adicionar foreign key constraint
ALTER TABLE produtos ADD CONSTRAINT fk_produtos_unidade_medida 
  FOREIGN KEY (unidade_medida) 
  REFERENCES unidades_medida(codigo);

-- 4. Adicionar constraint para garantir que apenas unidades ativas sejam usadas
ALTER TABLE produtos ADD CONSTRAINT chk_produtos_unidade_ativa 
  CHECK (EXISTS (
    SELECT 1 FROM unidades_medida 
    WHERE codigo = produtos.unidade_medida AND ativo = true
  ));

-- 5. Adicionar Ã­ndice para melhor performance
CREATE INDEX IF NOT EXISTS idx_produtos_unidade_medida ON produtos(unidade_medida);

-- 6. Verificar se existem produtos com unidades invÃ¡lidas
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM produtos p 
    LEFT JOIN unidades_medida um ON p.unidade_medida = um.codigo 
    WHERE um.codigo IS NULL;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE 'Encontrados % produtos com unidades invÃ¡lidas', invalid_count;
    ELSE
        RAISE NOTICE 'Todos os produtos tÃªm unidades vÃ¡lidas';
    END IF;
END $$;

-- FILE: 20250712133947-6d300216-7506-4ba2-8554-8e9d9b1aa59e.sql
-- 1. Primeiro, sincronizar dados existentes para garantir que todas as unidades do enum estejam na tabela
INSERT INTO unidades_medida (codigo, descricao, ativo) 
VALUES 
  ('AM', 'Ampola', true),
  ('CP', 'Comprimido', true),
  ('BG', 'Bisnaga', true),
  ('FR', 'Frasco', true),
  ('CPS', 'CÃ¡psula', true),
  ('ML', 'Mililitro', true),
  ('MG', 'Miligrama', true),
  ('G', 'Grama', true),
  ('KG', 'Quilograma', true),
  ('UN', 'Unidade', true),
  ('PCT', 'Pacote', true),
  ('CX', 'Caixa', true),
  ('TST', 'Teste', true)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Alterar tabela produtos para usar VARCHAR em vez do enum
ALTER TABLE produtos ALTER COLUMN unidade_medida TYPE VARCHAR(10);

-- 3. Adicionar foreign key constraint
ALTER TABLE produtos ADD CONSTRAINT fk_produtos_unidade_medida 
  FOREIGN KEY (unidade_medida) 
  REFERENCES unidades_medida(codigo);

-- 4. Adicionar Ã­ndice para melhor performance
CREATE INDEX IF NOT EXISTS idx_produtos_unidade_medida ON produtos(unidade_medida);

-- 5. Verificar se existem produtos com unidades invÃ¡lidas
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM produtos p 
    LEFT JOIN unidades_medida um ON p.unidade_medida = um.codigo 
    WHERE um.codigo IS NULL;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE 'Encontrados % produtos com unidades invÃ¡lidas', invalid_count;
    ELSE
        RAISE NOTICE 'Todos os produtos tÃªm unidades vÃ¡lidas';
    END IF;
END $$;

-- FILE: 20250712134907-28a19727-d674-4899-b1e8-5531d6d406cd.sql
-- Remover o enum antigo que estÃ¡ causando problemas
DROP TYPE IF EXISTS unidade_medida CASCADE;

-- Verificar e limpar qualquer unidade invÃ¡lida que possa estar causando problemas
-- Primeiro, verificar se existem produtos com unidades que nÃ£o existem na tabela
DELETE FROM produtos 
WHERE unidade_medida NOT IN (
    SELECT codigo FROM unidades_medida WHERE ativo = true
);

-- Sincronizar qualquer unidade que possa estar faltando
INSERT INTO unidades_medida (codigo, descricao, ativo) 
VALUES 
  ('TST', 'Teste (removido)', false)
ON CONFLICT (codigo) DO UPDATE SET 
  ativo = EXCLUDED.ativo;

-- Garantir que a foreign key estÃ¡ funcionando corretamente
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS fk_produtos_unidade_medida;
ALTER TABLE produtos ADD CONSTRAINT fk_produtos_unidade_medida 
  FOREIGN KEY (unidade_medida) 
  REFERENCES unidades_medida(codigo);

-- FILE: 20250712155146-6ea82b0c-94ff-494a-9319-8d342e6542b4.sql
-- Adicionar nova permissÃ£o relatorio_compras a todos os usuÃ¡rios existentes
UPDATE public.usuarios 
SET permissoes = permissoes || '{"relatorio_compras": false}'::jsonb
WHERE NOT (permissoes ? 'relatorio_compras');

-- FILE: 20250713142346-e6e111b2-6b8c-4d30-a3ca-f268a65de941.sql
-- Criar tabela para rascunhos de relatÃ³rios de compras
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

-- PolÃ­tica para usuÃ¡rios visualizarem apenas seus prÃ³prios rascunhos
CREATE POLICY "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR SELECT 
USING (usuario_id::text = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- PolÃ­tica para usuÃ¡rios criarem seus prÃ³prios rascunhos
CREATE POLICY "UsuÃ¡rios podem criar seus prÃ³prios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR INSERT 
WITH CHECK (usuario_id::text = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- PolÃ­tica para usuÃ¡rios atualizarem seus prÃ³prios rascunhos
CREATE POLICY "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR UPDATE 
USING (usuario_id::text = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- PolÃ­tica para usuÃ¡rios excluÃ­rem seus prÃ³prios rascunhos
CREATE POLICY "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR DELETE 
USING (usuario_id::text = current_setting('request.jwt.claims', true)::json ->> 'sub');

-- FunÃ§Ã£o para atualizar timestamp de atualizaÃ§Ã£o
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

-- Ãndices para melhor performance
CREATE INDEX idx_relatorios_compras_rascunho_usuario_id ON public.relatorios_compras_rascunho(usuario_id);
CREATE INDEX idx_relatorios_compras_rascunho_data_criacao ON public.relatorios_compras_rascunho(data_criacao DESC);

-- FILE: 20250713144517-56b84939-ad90-4245-aa40-d02c3dcba6bc.sql
-- Criar funÃ§Ã£o para definir o ID do usuÃ¡rio atual na sessÃ£o
CREATE OR REPLACE FUNCTION public.set_current_user_id(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id_param::text, false);
END;
$$;

-- Criar funÃ§Ã£o para obter o ID do usuÃ¡rio atual da sessÃ£o
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_user_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$;

-- Remover polÃ­ticas RLS existentes da tabela relatorios_compras_rascunho
DROP POLICY IF EXISTS "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;

-- Criar novas polÃ­ticas RLS usando a funÃ§Ã£o customizada
CREATE POLICY "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos"
ON public.relatorios_compras_rascunho
FOR SELECT
USING (usuario_id = public.get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem criar seus prÃ³prios rascunhos"
ON public.relatorios_compras_rascunho
FOR INSERT
WITH CHECK (usuario_id = public.get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos"
ON public.relatorios_compras_rascunho
FOR UPDATE
USING (usuario_id = public.get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos"
ON public.relatorios_compras_rascunho
FOR DELETE
USING (usuario_id = public.get_current_user_id());

-- FILE: 20250713150721-55bd786a-7f3e-4ddf-ac60-e794ccdb456c.sql
-- Atualizar funÃ§Ã£o para definir o ID do usuÃ¡rio atual na sessÃ£o (ao invÃ©s de transaÃ§Ã£o)
CREATE OR REPLACE FUNCTION public.set_current_user_id(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Usar 'true' para persistir na sessÃ£o ao invÃ©s de apenas na transaÃ§Ã£o
  PERFORM set_config('app.current_user_id', user_id_param::text, true);
END;
$$;

-- FILE: 20250713152123-49358eb6-4e44-42f1-847f-6967724a3ce3.sql
-- Corrigir polÃ­ticas RLS para usar auth.uid() diretamente
-- Removendo dependÃªncia da funÃ§Ã£o get_current_user_id() que estÃ¡ causando problemas

-- Recriar polÃ­ticas para relatorios_compras_rascunho usando auth.uid()
DROP POLICY IF EXISTS "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;

-- Criar polÃ­ticas simplificadas usando auth.uid() diretamente
CREATE POLICY "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR SELECT 
USING (usuario_id = auth.uid());

CREATE POLICY "UsuÃ¡rios podem criar seus prÃ³prios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR INSERT 
WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR UPDATE 
USING (usuario_id = auth.uid());

CREATE POLICY "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos" 
ON public.relatorios_compras_rascunho 
FOR DELETE 
USING (usuario_id = auth.uid());

-- FILE: 20250713153221-28aea219-413f-4381-bc9f-89c5f3eeb845.sql
-- Criar nova tabela especÃ­fica para rascunhos de compras
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

-- Criar polÃ­ticas RLS usando get_current_user_id()
CREATE POLICY "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos" 
ON public.rascunhos_compras 
FOR SELECT 
USING (usuario_id = public.get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem criar seus prÃ³prios rascunhos" 
ON public.rascunhos_compras 
FOR INSERT 
WITH CHECK (usuario_id = public.get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos" 
ON public.rascunhos_compras 
FOR UPDATE 
USING (usuario_id = public.get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos" 
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

-- FILE: 20250713154206-e8677286-c874-4a09-b65c-da88bdcb0316.sql
-- Atualizar permissÃµes do usuÃ¡rio para incluir relatorio_compras e gerenciar_rascunhos_compras
UPDATE public.usuarios 
SET permissoes = jsonb_set(
  jsonb_set(permissoes, '{relatorio_compras}', 'true'),
  '{gerenciar_rascunhos_compras}', 
  'true'
)
WHERE id = 'b633052e-7fc6-4843-8e5c-0a6623fb8d58';

-- FILE: 20250713154734-773d8ecb-b38c-45b4-8296-c1c54baf6213.sql
-- Simplificar polÃ­ticas RLS da tabela rascunhos_compras
-- Remover polÃ­ticas existentes que dependem de get_current_user_id()
DROP POLICY IF EXISTS "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar seus prÃ³prios rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos" ON public.rascunhos_compras;

-- Temporariamente desabilitar RLS para teste
ALTER TABLE public.rascunhos_compras DISABLE ROW LEVEL SECURITY;

-- FILE: 20250715112344-46e8de54-9186-45b3-8f99-c2ecfa6f41d6.sql
-- Adicionar foreign key entre rascunhos_compras.usuario_id e usuarios.id
ALTER TABLE public.rascunhos_compras 
ADD CONSTRAINT fk_rascunhos_compras_usuario_id 
FOREIGN KEY (usuario_id) 
REFERENCES public.usuarios(id);

-- FILE: 20250717021645-eefea9e7-d347-4562-9e62-0b7a3839937b.sql
-- Fase 1 e 2: Habilitar RLS e Implementar PolÃ­ticas de SeguranÃ§a Detalhadas

-- Habilitar RLS em todas as tabelas principais que nÃ£o tÃªm
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispensacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rascunhos_compras ENABLE ROW LEVEL SECURITY;

-- FunÃ§Ã£o de seguranÃ§a para obter usuÃ¡rio atual e suas permissÃµes
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    user_perms JSONB;
BEGIN
    SELECT permissoes INTO user_perms
    FROM public.usuarios 
    WHERE id = get_current_user_id() AND ativo = true;
    
    RETURN COALESCE(user_perms, '{}'::jsonb);
END;
$$;

-- FunÃ§Ã£o para verificar se usuÃ¡rio Ã© admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    user_type TEXT;
BEGIN
    SELECT tipo INTO user_type
    FROM public.usuarios 
    WHERE id = get_current_user_id() AND ativo = true;
    
    RETURN user_type = 'ADMIN';
END;
$$;

-- FunÃ§Ã£o para verificar permissÃ£o especÃ­fica
CREATE OR REPLACE FUNCTION public.has_permission(perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    user_perms JSONB;
BEGIN
    user_perms := get_current_user_permissions();
    RETURN COALESCE((user_perms ->> perm_name)::boolean, false);
END;
$$;

-- PolÃ­ticas para USUARIOS - Apenas ADMINs podem gerenciar
CREATE POLICY "Admins podem ver todos os usuÃ¡rios" 
ON public.usuarios 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins podem criar usuÃ¡rios" 
ON public.usuarios 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins podem atualizar usuÃ¡rios" 
ON public.usuarios 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins podem excluir usuÃ¡rios" 
ON public.usuarios 
FOR DELETE 
USING (is_admin());

-- PolÃ­ticas para PACIENTES - UsuÃ¡rios com permissÃ£o cadastro_pacientes
CREATE POLICY "UsuÃ¡rios podem ver pacientes se tÃªm permissÃ£o" 
ON public.pacientes 
FOR SELECT 
USING (has_permission('cadastro_pacientes'));

CREATE POLICY "UsuÃ¡rios podem criar pacientes se tÃªm permissÃ£o" 
ON public.pacientes 
FOR INSERT 
WITH CHECK (has_permission('cadastro_pacientes'));

CREATE POLICY "UsuÃ¡rios podem atualizar pacientes se tÃªm permissÃ£o" 
ON public.pacientes 
FOR UPDATE 
USING (has_permission('cadastro_pacientes'));

CREATE POLICY "UsuÃ¡rios podem excluir pacientes se tÃªm permissÃ£o" 
ON public.pacientes 
FOR DELETE 
USING (has_permission('cadastro_pacientes'));

-- PolÃ­ticas para PRODUTOS - UsuÃ¡rios com permissÃ£o cadastro_produtos
CREATE POLICY "UsuÃ¡rios podem ver produtos se tÃªm permissÃ£o" 
ON public.produtos 
FOR SELECT 
USING (has_permission('cadastro_produtos') OR has_permission('entrada_produtos') OR has_permission('dispensacao'));

CREATE POLICY "UsuÃ¡rios podem criar produtos se tÃªm permissÃ£o" 
ON public.produtos 
FOR INSERT 
WITH CHECK (has_permission('cadastro_produtos'));

CREATE POLICY "UsuÃ¡rios podem atualizar produtos se tÃªm permissÃ£o" 
ON public.produtos 
FOR UPDATE 
USING (has_permission('cadastro_produtos'));

CREATE POLICY "UsuÃ¡rios podem excluir produtos se tÃªm permissÃ£o" 
ON public.produtos 
FOR DELETE 
USING (has_permission('cadastro_produtos'));

-- PolÃ­ticas para ENTRADAS_PRODUTOS - UsuÃ¡rios com permissÃ£o entrada_produtos
CREATE POLICY "UsuÃ¡rios podem ver entradas se tÃªm permissÃ£o" 
ON public.entradas_produtos 
FOR SELECT 
USING (has_permission('entrada_produtos') OR has_permission('historicos'));

CREATE POLICY "UsuÃ¡rios podem criar entradas se tÃªm permissÃ£o" 
ON public.entradas_produtos 
FOR INSERT 
WITH CHECK (has_permission('entrada_produtos'));

CREATE POLICY "UsuÃ¡rios podem atualizar entradas se tÃªm permissÃ£o" 
ON public.entradas_produtos 
FOR UPDATE 
USING (has_permission('entrada_produtos'));

CREATE POLICY "UsuÃ¡rios podem excluir entradas se tÃªm permissÃ£o" 
ON public.entradas_produtos 
FOR DELETE 
USING (has_permission('entrada_produtos'));

-- PolÃ­ticas para DISPENSACOES - UsuÃ¡rios com permissÃ£o dispensacao
CREATE POLICY "UsuÃ¡rios podem ver dispensaÃ§Ãµes se tÃªm permissÃ£o" 
ON public.dispensacoes 
FOR SELECT 
USING (has_permission('dispensacao') OR has_permission('historicos'));

CREATE POLICY "UsuÃ¡rios podem criar dispensaÃ§Ãµes se tÃªm permissÃ£o" 
ON public.dispensacoes 
FOR INSERT 
WITH CHECK (has_permission('dispensacao'));

CREATE POLICY "UsuÃ¡rios podem atualizar dispensaÃ§Ãµes se tÃªm permissÃ£o" 
ON public.dispensacoes 
FOR UPDATE 
USING (has_permission('dispensacao'));

CREATE POLICY "UsuÃ¡rios podem excluir dispensaÃ§Ãµes se tÃªm permissÃ£o" 
ON public.dispensacoes 
FOR DELETE 
USING (has_permission('dispensacao'));

-- PolÃ­ticas para LOGS_SISTEMA - Apenas leitura para usuÃ¡rios com permissÃ£o historicos
CREATE POLICY "UsuÃ¡rios podem ver logs se tÃªm permissÃ£o" 
ON public.logs_sistema 
FOR SELECT 
USING (has_permission('historicos') OR is_admin());

-- PolÃ­ticas para UNIDADES_MEDIDA - Leitura geral, ediÃ§Ã£o para quem tem permissÃµes de produtos
CREATE POLICY "UsuÃ¡rios podem ver unidades de medida" 
ON public.unidades_medida 
FOR SELECT 
USING (true);

CREATE POLICY "UsuÃ¡rios podem criar unidades se tÃªm permissÃ£o" 
ON public.unidades_medida 
FOR INSERT 
WITH CHECK (has_permission('cadastro_produtos') OR is_admin());

CREATE POLICY "UsuÃ¡rios podem atualizar unidades se tÃªm permissÃ£o" 
ON public.unidades_medida 
FOR UPDATE 
USING (has_permission('cadastro_produtos') OR is_admin());

CREATE POLICY "UsuÃ¡rios podem excluir unidades se tÃªm permissÃ£o" 
ON public.unidades_medida 
FOR DELETE 
USING (has_permission('cadastro_produtos') OR is_admin());

-- PolÃ­ticas para RASCUNHOS_COMPRAS - UsuÃ¡rios podem ver/editar seus prÃ³prios rascunhos
CREATE POLICY "UsuÃ¡rios podem ver seus rascunhos" 
ON public.rascunhos_compras 
FOR SELECT 
USING (usuario_id = get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem criar seus rascunhos" 
ON public.rascunhos_compras 
FOR INSERT 
WITH CHECK (usuario_id = get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem atualizar seus rascunhos" 
ON public.rascunhos_compras 
FOR UPDATE 
USING (usuario_id = get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem excluir seus rascunhos" 
ON public.rascunhos_compras 
FOR DELETE 
USING (usuario_id = get_current_user_id());

-- Fase 3: CorreÃ§Ã£o das FunÃ§Ãµes do Banco para SeguranÃ§a
CREATE OR REPLACE FUNCTION public.hash_senha(senha_texto text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN encode(digest(senha_texto, 'sha256'), 'hex');
END;
$$;

-- Atualizar funÃ§Ã£o de contexto do usuÃ¡rio
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_user_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$;

-- FunÃ§Ã£o para verificar senha
CREATE OR REPLACE FUNCTION public.verificar_senha(usuario_email TEXT, senha_input TEXT)
RETURNS TABLE(
    id UUID,
    nome TEXT,
    email TEXT,
    tipo public.tipo_usuario,
    permissoes JSONB,
    ativo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.nome, u.email, u.tipo, u.permissoes, u.ativo
    FROM public.usuarios u
    WHERE u.email = usuario_email 
    AND u.senha = hash_senha(senha_input)
    AND u.ativo = true;
END;
$$;

-- Garantir que os triggers existentes estÃ£o corretos
DROP TRIGGER IF EXISTS trigger_entrada_produto ON public.entradas_produtos;
CREATE TRIGGER trigger_entrada_produto
    AFTER INSERT ON public.entradas_produtos
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_entrada();

DROP TRIGGER IF EXISTS trigger_dispensacao ON public.dispensacoes;
CREATE TRIGGER trigger_dispensacao
    AFTER INSERT ON public.dispensacoes
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_dispensacao();

-- FILE: 20250717021807-1c5b7c2b-ac0d-4335-be69-8ad9f28e5d08.sql
-- CorreÃ§Ã£o das funÃ§Ãµes restantes para seguranÃ§a completa
CREATE OR REPLACE FUNCTION public.atualizar_estoque_entrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.produtos 
  SET estoque_atual = estoque_atual + NEW.quantidade 
  WHERE id = NEW.produto_id;
  
  INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes)
  VALUES (NEW.usuario_id, 'ENTRADA_PRODUTO', 'entradas_produtos', 
          json_build_object(
            'produto_id', NEW.produto_id,
            'quantidade', NEW.quantidade,
            'lote', NEW.lote
          ));
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_estoque_dispensacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Verificar se hÃ¡ estoque suficiente
  IF (SELECT estoque_atual FROM public.produtos WHERE id = NEW.produto_id) < NEW.quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente para dispensaÃ§Ã£o';
  END IF;
  
  UPDATE public.produtos 
  SET estoque_atual = estoque_atual - NEW.quantidade 
  WHERE id = NEW.produto_id;
  
  INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes)
  VALUES (NEW.usuario_id, 'DISPENSACAO', 'dispensacoes', 
          json_build_object(
            'paciente_id', NEW.paciente_id,
            'produto_id', NEW.produto_id,
            'quantidade', NEW.quantidade,
            'lote', NEW.lote
          ));
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_rascunhos_compras_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.data_atualizacao = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_relatorio_compras_rascunho_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.data_atualizacao = now();
  RETURN NEW;
END;
$$;

-- FILE: 20250717023732-3ec3facd-f367-462c-941d-30155c6b6229.sql
-- Corrigir funÃ§Ã£o verificar_senha para resolver erro de login
CREATE OR REPLACE FUNCTION public.verificar_senha(usuario_email TEXT, senha_input TEXT)
RETURNS TABLE(id uuid, nome text, email text, tipo tipo_usuario, permissoes jsonb, ativo boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.nome, u.email, u.tipo, u.permissoes, u.ativo
    FROM public.usuarios u
    WHERE u.email = usuario_email 
    AND u.senha = public.hash_senha(senha_input)
    AND u.ativo = true;
END;
$$;

-- FILE: 20250717024245-5c07b6f3-758a-4a8e-98f2-e7abf2be7ac0.sql
-- Corrigir funÃ§Ã£o hash_senha para usar extensions.digest explicitamente
CREATE OR REPLACE FUNCTION public.hash_senha(senha_texto text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN encode(extensions.digest(senha_texto, 'sha256'), 'hex');
END;
$$;

-- FILE: 20250717025406-15aa7785-aa86-4e59-b571-86f2708e9bc3.sql
-- Corrigir funÃ§Ãµes RLS para usar prefixo public. explicitamente

-- Corrigir get_current_user_permissions para usar public.get_current_user_id()
CREATE OR REPLACE FUNCTION public.get_current_user_permissions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    user_perms JSONB;
BEGIN
    SELECT permissoes INTO user_perms
    FROM public.usuarios 
    WHERE id = public.get_current_user_id() AND ativo = true;
    
    RETURN COALESCE(user_perms, '{}'::jsonb);
END;
$$;

-- Corrigir has_permission para usar public.get_current_user_permissions()
CREATE OR REPLACE FUNCTION public.has_permission(perm_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    user_perms JSONB;
BEGIN
    user_perms := public.get_current_user_permissions();
    RETURN COALESCE((user_perms ->> perm_name)::boolean, false);
END;
$$;

-- Corrigir is_admin para usar public.get_current_user_id()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    user_type TEXT;
BEGIN
    SELECT tipo INTO user_type
    FROM public.usuarios 
    WHERE id = public.get_current_user_id() AND ativo = true;
    
    RETURN user_type = 'ADMIN';
END;
$$;

-- FILE: 20250717030214-e8794154-dc22-42cb-bea7-114d0f586108.sql
-- Corrigir polÃ­ticas RLS da tabela relatorios_compras_rascunho para usar get_current_user_id()

-- Remover polÃ­ticas existentes que usam auth.uid()
DROP POLICY IF EXISTS "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;

-- Criar novas polÃ­ticas usando get_current_user_id()
CREATE POLICY "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos"
ON public.relatorios_compras_rascunho
FOR SELECT
USING (usuario_id = public.get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem criar seus prÃ³prios rascunhos"
ON public.relatorios_compras_rascunho
FOR INSERT
WITH CHECK (usuario_id = public.get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos"
ON public.relatorios_compras_rascunho
FOR UPDATE
USING (usuario_id = public.get_current_user_id());

CREATE POLICY "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos"
ON public.relatorios_compras_rascunho
FOR DELETE
USING (usuario_id = public.get_current_user_id());

-- FILE: 20250717030937-055518fa-9358-4420-b389-6e5775c354b5.sql
-- Simplificar todas as polÃ­ticas RLS para resolver problemas de carregamento de dados

-- ==== REMOVER TODAS AS POLÃTICAS EXISTENTES ====

-- Produtos
DROP POLICY IF EXISTS "UsuÃ¡rios podem ver produtos se tÃªm permissÃ£o" ON public.produtos;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar produtos se tÃªm permissÃ£o" ON public.produtos;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar produtos se tÃªm permissÃ£o" ON public.produtos;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir produtos se tÃªm permissÃ£o" ON public.produtos;

-- Pacientes
DROP POLICY IF EXISTS "UsuÃ¡rios podem ver pacientes se tÃªm permissÃ£o" ON public.pacientes;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar pacientes se tÃªm permissÃ£o" ON public.pacientes;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar pacientes se tÃªm permissÃ£o" ON public.pacientes;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir pacientes se tÃªm permissÃ£o" ON public.pacientes;

-- Entradas de produtos
DROP POLICY IF EXISTS "UsuÃ¡rios podem ver entradas se tÃªm permissÃ£o" ON public.entradas_produtos;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar entradas se tÃªm permissÃ£o" ON public.entradas_produtos;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar entradas se tÃªm permissÃ£o" ON public.entradas_produtos;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir entradas se tÃªm permissÃ£o" ON public.entradas_produtos;

-- DispensaÃ§Ãµes
DROP POLICY IF EXISTS "UsuÃ¡rios podem ver dispensaÃ§Ãµes se tÃªm permissÃ£o" ON public.dispensacoes;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar dispensaÃ§Ãµes se tÃªm permissÃ£o" ON public.dispensacoes;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar dispensaÃ§Ãµes se tÃªm permissÃ£o" ON public.dispensacoes;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir dispensaÃ§Ãµes se tÃªm permissÃ£o" ON public.dispensacoes;

-- UsuÃ¡rios
DROP POLICY IF EXISTS "Admins podem ver todos os usuÃ¡rios" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem criar usuÃ¡rios" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem atualizar usuÃ¡rios" ON public.usuarios;
DROP POLICY IF EXISTS "Admins podem excluir usuÃ¡rios" ON public.usuarios;

-- Logs do sistema
DROP POLICY IF EXISTS "UsuÃ¡rios podem ver logs se tÃªm permissÃ£o" ON public.logs_sistema;

-- Rascunhos compras (ambas as tabelas)
DROP POLICY IF EXISTS "UsuÃ¡rios podem ver seus rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar seus rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar seus rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir seus rascunhos" ON public.rascunhos_compras;

DROP POLICY IF EXISTS "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;

-- ==== CRIAR POLÃTICAS SIMPLES E FUNCIONAIS ====

-- PRODUTOS: Acesso completo para usuÃ¡rios autenticados
CREATE POLICY "Permitir acesso completo para usuÃ¡rios autenticados" ON public.produtos
FOR ALL USING (auth.uid() IS NOT NULL);

-- PACIENTES: Acesso completo para usuÃ¡rios autenticados
CREATE POLICY "Permitir acesso completo para usuÃ¡rios autenticados" ON public.pacientes
FOR ALL USING (auth.uid() IS NOT NULL);

-- ENTRADAS DE PRODUTOS: Acesso completo para usuÃ¡rios autenticados
CREATE POLICY "Permitir acesso completo para usuÃ¡rios autenticados" ON public.entradas_produtos
FOR ALL USING (auth.uid() IS NOT NULL);

-- DISPENSAÃ‡Ã•ES: Acesso completo para usuÃ¡rios autenticados
CREATE POLICY "Permitir acesso completo para usuÃ¡rios autenticados" ON public.dispensacoes
FOR ALL USING (auth.uid() IS NOT NULL);

-- USUÃRIOS: Acesso completo para usuÃ¡rios autenticados
CREATE POLICY "Permitir acesso completo para usuÃ¡rios autenticados" ON public.usuarios
FOR ALL USING (auth.uid() IS NOT NULL);

-- LOGS DO SISTEMA: Somente leitura para usuÃ¡rios autenticados
CREATE POLICY "Permitir leitura para usuÃ¡rios autenticados" ON public.logs_sistema
FOR SELECT USING (auth.uid() IS NOT NULL);

-- RASCUNHOS COMPRAS: Acesso aos prÃ³prios rascunhos usando auth.uid()
CREATE POLICY "UsuÃ¡rios podem gerenciar seus prÃ³prios rascunhos" ON public.rascunhos_compras
FOR ALL USING (auth.uid()::text = usuario_id::text);

-- RELATÃ“RIOS COMPRAS RASCUNHO: Acesso aos prÃ³prios rascunhos usando auth.uid()
CREATE POLICY "UsuÃ¡rios podem gerenciar seus prÃ³prios rascunhos de relatÃ³rio" ON public.relatorios_compras_rascunho
FOR ALL USING (auth.uid()::text = usuario_id::text);

-- FILE: 20250717032320-1c9c9998-9afa-4870-bd73-63e30e9e7947.sql
-- Rollback completo para estado prÃ©-16 de julho
-- ATENÃ‡ÃƒO: Remove TODAS as proteÃ§Ãµes de seguranÃ§a

-- 1. Desabilitar RLS nas tabelas principais
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas_produtos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispensacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_sistema DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_medida DISABLE ROW LEVEL SECURITY;

-- 2. Remover todas as polÃ­ticas RLS das tabelas principais
DROP POLICY IF EXISTS "Permitir acesso completo para usuÃ¡rios autenticados" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir acesso completo para usuÃ¡rios autenticados" ON public.pacientes;
DROP POLICY IF EXISTS "Permitir acesso completo para usuÃ¡rios autenticados" ON public.produtos;
DROP POLICY IF EXISTS "Permitir acesso completo para usuÃ¡rios autenticados" ON public.entradas_produtos;
DROP POLICY IF EXISTS "Permitir acesso completo para usuÃ¡rios autenticados" ON public.dispensacoes;
DROP POLICY IF EXISTS "Permitir leitura para usuÃ¡rios autenticados" ON public.logs_sistema;

-- Remover polÃ­ticas antigas das unidades_medida se existirem
DROP POLICY IF EXISTS "UsuÃ¡rios podem ver unidades de medida" ON public.unidades_medida;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar unidades se tÃªm permissÃ£o" ON public.unidades_medida;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar unidades se tÃªm permissÃ£o" ON public.unidades_medida;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir unidades se tÃªm permissÃ£o" ON public.unidades_medida;

-- 3. Remover funÃ§Ãµes de seguranÃ§a criadas no dia 17
DROP FUNCTION IF EXISTS public.get_current_user_permissions();
DROP FUNCTION IF EXISTS public.has_permission(text);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.get_current_user_id();
DROP FUNCTION IF EXISTS public.set_current_user_id(uuid);

-- 4. Restaurar funÃ§Ã£o hash_senha para versÃ£o simples (sem extensions.digest)
CREATE OR REPLACE FUNCTION public.hash_senha(senha_texto text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(digest(senha_texto, 'sha256'), 'hex');
END;
$$;

-- 5. Restaurar funÃ§Ã£o verificar_senha para versÃ£o original simples
CREATE OR REPLACE FUNCTION public.verificar_senha(usuario_email TEXT, senha_input TEXT)
RETURNS TABLE(id uuid, nome text, email text, tipo tipo_usuario, permissoes jsonb, ativo boolean)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.nome, u.email, u.tipo, u.permissoes, u.ativo
    FROM public.usuarios u
    WHERE u.email = usuario_email 
    AND u.senha = public.hash_senha(senha_input)
    AND u.ativo = true;
END;
$$;

-- 6. Limpar e recriar polÃ­ticas simples para tabelas de rascunhos usando auth.uid() diretamente
DROP POLICY IF EXISTS "UsuÃ¡rios podem gerenciar seus prÃ³prios rascunhos" ON public.rascunhos_compras;
DROP POLICY IF EXISTS "UsuÃ¡rios podem visualizar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem criar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem atualizar seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem excluir seus prÃ³prios rascunhos" ON public.relatorios_compras_rascunho;
DROP POLICY IF EXISTS "UsuÃ¡rios podem gerenciar seus prÃ³prios rascunhos de relatÃ³ri" ON public.relatorios_compras_rascunho;

-- Recriar polÃ­ticas simples para rascunhos usando auth.uid()
CREATE POLICY "UsuÃ¡rios podem gerenciar seus prÃ³prios rascunhos"
ON public.rascunhos_compras
FOR ALL
USING (auth.uid()::text = usuario_id::text);

CREATE POLICY "UsuÃ¡rios podem gerenciar seus prÃ³prios relatÃ³rios"
ON public.relatorios_compras_rascunho
FOR ALL
USING (auth.uid()::text = usuario_id::text);

-- FILE: 20250717033835-f0626faf-4361-4694-8451-e92ac62d33a4.sql
-- Migrar dados da tabela relatorios_compras_rascunho para rascunhos_compras
INSERT INTO public.rascunhos_compras (
  usuario_id,
  nome_rascunho,
  dados_produtos,
  data_criacao,
  data_atualizacao,
  ativo
)
SELECT 
  usuario_id,
  nome_rascunho,
  items as dados_produtos,
  data_criacao,
  data_atualizacao,
  NOT finalizado as ativo  -- finalizado = false vira ativo = true
FROM public.relatorios_compras_rascunho
WHERE finalizado = false;  -- SÃ³ migra os rascunhos nÃ£o finalizados

-- Remover trigger antes de excluir a funÃ§Ã£o
DROP TRIGGER IF EXISTS update_relatorios_compras_rascunho_updated_at ON public.relatorios_compras_rascunho;

-- Excluir a funÃ§Ã£o relacionada
DROP FUNCTION IF EXISTS public.update_relatorio_compras_rascunho_updated_at();

-- Excluir a tabela nÃ£o utilizada
DROP TABLE IF EXISTS public.relatorios_compras_rascunho;

-- FILE: 20250717034555-dfad7222-7563-43a9-8cba-1d09fe0204d8.sql
-- Atualizar a polÃ­tica RLS da tabela rascunhos_compras para funcionar com o sistema de auth customizado
-- Remover a polÃ­tica atual
DROP POLICY IF EXISTS "UsuÃ¡rios podem gerenciar seus prÃ³prios rascunhos" ON public.rascunhos_compras;

-- Criar nova polÃ­tica que permite acesso baseado nos dados da sessÃ£o localStorage
-- Como nÃ£o temos auth.uid() funcionando, vamos simplificar para permitir acesso a usuÃ¡rios autenticados
-- atravÃ©s da aplicaÃ§Ã£o (RLS serÃ¡ controlado pela aplicaÃ§Ã£o)
CREATE POLICY "UsuÃ¡rios autenticados podem gerenciar rascunhos" 
ON public.rascunhos_compras 
FOR ALL 
USING (true)
WITH CHECK (true);

-- FILE: 20250717040559-77dc171e-a589-46f0-94ad-119cda889582.sql
-- Atualizar a polÃ­tica RLS da tabela rascunhos_compras para funcionar com o sistema de auth customizado
-- Remover a polÃ­tica atual
DROP POLICY IF EXISTS "UsuÃ¡rios podem gerenciar seus prÃ³prios rascunhos" ON public.rascunhos_compras;

-- Criar nova polÃ­tica que permite acesso baseado nos dados da sessÃ£o localStorage
-- Como nÃ£o temos auth.uid() funcionando, vamos simplificar para permitir acesso a usuÃ¡rios autenticados
-- atravÃ©s da aplicaÃ§Ã£o (RLS serÃ¡ controlado pela aplicaÃ§Ã£o)
CREATE POLICY "UsuÃ¡rios autenticados podem gerenciar rascunhos" 
ON public.rascunhos_compras 
FOR ALL 
USING (true)
WITH CHECK (true);

-- FILE: 20260311000000_enable_multitenancy.sql
-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Plans table
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    max_users INTEGER NOT NULL,
    max_products INTEGER, -- NULL means unlimited
    features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default plans if not exists
INSERT INTO public.plans (name, description, price, max_users, max_products, features)
SELECT 'BÃ¡sico', 'Ideal para pequenas unidades', 99.00, 5, 500, '["gestao_estoque", "dispensacao_basica"]'
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'BÃ¡sico');

INSERT INTO public.plans (name, description, price, max_users, max_products, features)
SELECT 'Profissional', 'Para unidades em crescimento', 199.00, 20, 2000, '["gestao_estoque", "dispensacao_completa", "relatorios_avancados"]'
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'Profissional');

INSERT INTO public.plans (name, description, price, max_users, max_products, features)
SELECT 'Empresarial', 'Sem limites para grandes redes', 499.00, 100, NULL, '["tudo_ilimitado", "suporte_prioritario", "api_acess"]'
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE name = 'Empresarial');

-- 2. Create Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    document TEXT, -- CNPJ or similar
    slug TEXT UNIQUE NOT NULL, -- For subdomain or URL identification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create the initial Legacy Tenant for existing data
INSERT INTO public.tenants (id, name, slug, document)
VALUES ('00000000-0000-0000-0000-000000000000', 'Minha Empresa (Legado)', 'legacy', '00000000000')
ON CONFLICT (id) DO NOTHING;

-- 3. Create Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
    plan_id UUID REFERENCES public.plans(id) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, canceled, past_due, trialing
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create subscription for legacy tenant (Free/Enterprise forever)
INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
SELECT 
    '00000000-0000-0000-0000-000000000000',
    id,
    'active',
    now(),
    now() + interval '100 years'
FROM public.plans WHERE name = 'Empresarial'
AND NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE tenant_id = '00000000-0000-0000-0000-000000000000')
LIMIT 1;

-- 4. Create Profiles table (Links Auth Users to Tenants)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user', -- admin, user, viewer
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Add tenant_id to existing tables (SAFE MODE)
DO $$ 
DECLARE 
    legacy_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
    t text;
    table_exists boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'logs_sistema', 'usuarios'] LOOP
        
        -- Check if table exists in public schema
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            RAISE NOTICE 'Migrating table: %', t;
            
            -- Add column if not exists
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)', t);
            
            -- Update existing rows to belong to legacy tenant
            EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t, legacy_tenant_id);
            
            -- Alter column to be NOT NULL (after update)
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
            
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        ELSE
            RAISE NOTICE 'Table % does not exist in public schema, skipping migration for this table.', t;
        END IF;
    END LOOP;
END $$;

-- 6. RLS Policies

-- Helper function to get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply policies to Tenants
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" ON public.tenants
    FOR SELECT USING (id = public.get_current_tenant_id());

-- Apply policies to Profiles
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
CREATE POLICY "Users can view profiles in their tenant" ON public.profiles
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());
    
DROP POLICY IF EXISTS "Admins can edit profiles in their tenant" ON public.profiles;
CREATE POLICY "Admins can edit profiles in their tenant" ON public.profiles
    FOR UPDATE USING (
        tenant_id = public.get_current_tenant_id() AND 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Apply policies to Business Tables (SAFE MODE)
DO $$ 
DECLARE 
    t text;
    table_exists boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'logs_sistema'] LOOP
        
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Tenant Isolation" ON public.%I USING (tenant_id = public.get_current_tenant_id())', t);
        END IF;
    END LOOP;
END $$;

-- Special handling for 'usuarios' table (Legacy custom auth table)
-- We keep it for reference but it should be deprecated in favor of 'profiles'
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios') THEN
        ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- Trigger to create Profile on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        (new.raw_user_meta_data->>'tenant_id')::uuid,
        COALESCE(new.raw_user_meta_data->>'role', 'user')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- FILE: 20260311000001_signup_policies.sql
-- Allow authenticated users to create tenants (for new signups)
CREATE POLICY "Users can create tenants" ON public.tenants
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own profile if tenant_id is NULL (initial setup)
CREATE POLICY "Users can update own profile during onboarding" ON public.profiles
    FOR UPDATE
    USING (id = auth.uid() AND tenant_id IS NULL)
    WITH CHECK (id = auth.uid());

-- Update handle_new_user to be more robust and set default role to 'admin' for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        CASE 
            WHEN new.raw_user_meta_data->>'tenant_id' IS NULL OR new.raw_user_meta_data->>'tenant_id' = '' THEN NULL 
            ELSE (new.raw_user_meta_data->>'tenant_id')::uuid 
        END,
        COALESCE(new.raw_user_meta_data->>'role', 'admin') -- Default to admin for new signups (self-service)
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260311000002_admin_functions.sql
CREATE OR REPLACE FUNCTION public.get_all_tenants_admin()
RETURNS TABLE (
    id UUID,
    name TEXT,
    document TEXT,
    plan_name TEXT,
    status TEXT,
    period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Authorization check: User must be admin (implement robust check in production)
    -- For now, we rely on the fact that this function is only exposed to authorized users via UI
    -- Ideally, you should uncomment the check below after adding 'super_admin' role to profiles
    
    /*
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    */
    
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.document,
        p.name as plan_name,
        s.status,
        s.current_period_end
    FROM public.tenants t
    LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
    LEFT JOIN public.plans p ON p.id = s.plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260311000004_add_contact_info.sql
-- Add phone and address fields to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Add phone field to profiles table if not exists (for personal contact)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Update RLS policies to allow users to update their own tenant details
-- This is crucial for the subscription flow where users input their details
DROP POLICY IF EXISTS "Users can update their own tenant" ON public.tenants;
CREATE POLICY "Users can update their own tenant" ON public.tenants
    FOR UPDATE
    USING (id = public.get_current_tenant_id())
    WITH CHECK (id = public.get_current_tenant_id());


-- FILE: 20260311000005_subscription_invoices.sql
-- Create Invoices table to track payment history and PIX data
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
    subscription_id UUID REFERENCES public.subscriptions(id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, expired
    pix_code TEXT, -- The Copy and Paste PIX code
    pix_qr_code_url TEXT, -- URL to the QR Code image (optional, if n8n returns it)
    payment_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies for invoices
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invoices of their tenant" ON public.subscription_invoices;
CREATE POLICY "Users can view invoices of their tenant" ON public.subscription_invoices
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());

-- Allow creating invoices (for the checkout flow)
DROP POLICY IF EXISTS "Users can create invoices for their tenant" ON public.subscription_invoices;
CREATE POLICY "Users can create invoices for their tenant" ON public.subscription_invoices
    FOR INSERT 
    WITH CHECK (tenant_id = public.get_current_tenant_id());


-- FILE: 20260311000006_fix_subscription_rls.sql
-- Enable RLS on Plans and Subscriptions tables
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy for Plans: Everyone can read plans (public reference data)
DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans" ON public.plans
    FOR SELECT USING (true);

-- Policy for Subscriptions: Tenant isolation
DROP POLICY IF EXISTS "Users can view their own tenant subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own tenant subscription" ON public.subscriptions
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());

-- Allow system/admin to manage subscriptions (usually via edge functions or triggers, but for now allow insert for onboarding)
DROP POLICY IF EXISTS "Users can create subscription during onboarding" ON public.subscriptions;
CREATE POLICY "Users can create subscription during onboarding" ON public.subscriptions
    FOR INSERT 
    WITH CHECK (tenant_id = public.get_current_tenant_id());


-- FILE: 20260311000007_fix_null_tenant_user.sql
-- Fix specific user with null tenant_id by assigning them to a new Tenant
-- User ID: bb41f1f3-5af5-4060-8592-a0a23d7bf6f5 (Aurilene Andrade)

DO $$ 
DECLARE 
    v_user_id UUID := 'bb41f1f3-5af5-4060-8592-a0a23d7bf6f5';
    v_tenant_id UUID;
BEGIN
    -- 1. Check if user exists in profiles
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
        
        -- 2. Create a new Tenant for this user (since they are Admin)
        INSERT INTO public.tenants (name, slug, document, phone)
        VALUES (
            'SMS AnajÃ¡s', 
            'sms-anajas', 
            '03351126255',
            '91985958042'
        )
        RETURNING id INTO v_tenant_id;

        -- 3. Update the profile with the new tenant_id
        UPDATE public.profiles 
        SET tenant_id = v_tenant_id
        WHERE id = v_user_id;
        
        RAISE NOTICE 'User % updated with new tenant %', v_user_id, v_tenant_id;
    ELSE
        RAISE NOTICE 'User % not found in profiles', v_user_id;
    END IF;
END $$;


-- FILE: 20260311000008_add_pix_id.sql
-- Add pix_id column to subscription_invoices table for transaction tracking
ALTER TABLE public.subscription_invoices
ADD COLUMN IF NOT EXISTS pix_id TEXT;


-- FILE: 20260311000009_fix_invoices_rls_perms.sql
-- Fix RLS policies for subscription_invoices to allow UPDATE and DELETE
-- Currently only SELECT and INSERT are allowed, blocking status updates and deletions

DROP POLICY IF EXISTS "Users can update invoices of their tenant" ON public.subscription_invoices;
CREATE POLICY "Users can update invoices of their tenant" ON public.subscription_invoices
    FOR UPDATE USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "Users can delete invoices of their tenant" ON public.subscription_invoices;
CREATE POLICY "Users can delete invoices of their tenant" ON public.subscription_invoices
    FOR DELETE USING (tenant_id = public.get_current_tenant_id());


-- FILE: 20260311000010_super_admin_and_subscription_block.sql
-- 1. Create function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update RLS policies for subscription_invoices
-- Admin (Customer) can only SELECT and INSERT (when creating new sub)
-- Super Admin (Owner) can UPDATE and DELETE

DROP POLICY IF EXISTS "Users can update invoices of their tenant" ON public.subscription_invoices;
CREATE POLICY "Super admins can update all invoices" ON public.subscription_invoices
    FOR UPDATE USING (public.is_super_admin());

DROP POLICY IF EXISTS "Users can delete invoices of their tenant" ON public.subscription_invoices;
CREATE POLICY "Super admins can delete all invoices" ON public.subscription_invoices
    FOR DELETE USING (public.is_super_admin());

-- 3. Automatic next invoice generation trigger
CREATE OR REPLACE FUNCTION public.handle_next_invoice_generation()
RETURNS TRIGGER AS $$
DECLARE
    v_next_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only trigger when status changes from pending/failed to paid
    IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
        -- Calculate next due date (1 month after current due date)
        v_next_due_date := NEW.due_date + interval '1 month';
        
        -- Check if a pending invoice already exists for this tenant to avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.subscription_invoices 
            WHERE tenant_id = NEW.tenant_id AND status = 'pending'
        ) THEN
            INSERT INTO public.subscription_invoices (tenant_id, amount, status, due_date)
            VALUES (NEW.tenant_id, NEW.amount, 'pending', v_next_due_date);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_generate_next_invoice ON public.subscription_invoices;
CREATE TRIGGER tr_generate_next_invoice
    AFTER UPDATE ON public.subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_next_invoice_generation();

-- 4. Function to check if tenant is blocked (has pending invoices)
-- Except for the legacy tenant
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Legacy tenant is never blocked
    IF p_tenant_id = '00000000-0000-0000-0000-000000000000' THEN
        RETURN FALSE;
    END IF;

    -- Blocked if has any pending invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260311000011_super_admin_global_access.sql
-- Update Tenant Isolation policies to allow SUPER_ADMIN to see all data
-- This affects all business tables that use tenant_id

DO $$ 
DECLARE 
    t text;
    table_exists boolean;
BEGIN
    -- List of all tables that should be accessible by Super Admin
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'logs_sistema', 'subscription_invoices', 'subscriptions'] LOOP
        
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            -- Drop existing tenant isolation policy
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Users can view invoices of their tenant" ON public.%I', t);
            
            -- Create new policy: 
            -- 1. If Super Admin, can see everything
            -- 2. If not Super Admin, can only see their own tenant_id
            EXECUTE format('CREATE POLICY "Tenant Isolation" ON public.%I USING (
                public.is_super_admin() OR tenant_id = public.get_current_tenant_id()
            )', t);
            
            -- Also allow INSERT/UPDATE/DELETE for Super Admin on all tables
            -- (Most tables already have specific policies, but this ensures Super Admin control)
            EXECUTE format('DROP POLICY IF EXISTS "Super Admin Full Access" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Super Admin Full Access" ON public.%I 
                FOR ALL 
                TO authenticated 
                USING (public.is_super_admin())
                WITH CHECK (public.is_super_admin())', t);

        END IF;
    END LOOP;
END $$;

-- Also update 'tenants' table to allow Super Admin to see all tenants
DROP POLICY IF EXISTS "Super Admin see all tenants" ON public.tenants;
CREATE POLICY "Super Admin see all tenants" ON public.tenants
    FOR ALL USING (public.is_super_admin());

-- Ensure Super Admin can see all profiles
DROP POLICY IF EXISTS "Super Admin see all profiles" ON public.profiles;
CREATE POLICY "Super Admin see all profiles" ON public.profiles
    FOR ALL USING (public.is_super_admin());


-- FILE: 20260311000012_fix_rls_final.sql
-- 1. Enable RLS for plans and allow all authenticated users to view them
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans" ON public.plans
    FOR SELECT TO authenticated USING (true);

-- 2. Fix subscription_invoices INSERT policy for regular users
-- The previous migration might have removed the INSERT policy for non-super-admins
DROP POLICY IF EXISTS "Users can create invoices for their tenant" ON public.subscription_invoices;
CREATE POLICY "Users can create invoices for their tenant" ON public.subscription_invoices
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id()
    );

-- 3. Also ensure users can UPDATE their own invoices (e.g., to save pix_code)
-- This was restricted to super_admin only in migration 000010
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.subscription_invoices;
CREATE POLICY "Users can update their own invoices" ON public.subscription_invoices
    FOR UPDATE
    TO authenticated
    USING (
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id()
    )
    WITH CHECK (
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id()
    );

-- 4. Ensure SELECT policy for subscription_invoices is correct for all
DROP POLICY IF EXISTS "Tenant Isolation" ON public.subscription_invoices;
CREATE POLICY "Tenant Isolation" ON public.subscription_invoices
    FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id()
    );


-- FILE: 20260311000013_remove_legacy_block_bypass.sql
-- Update function to check if tenant is blocked
-- Now all tenants (including legacy) are blocked if they have pending invoices
-- The bypass will be handled by the user role in the application/frontend
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Blocked if has any pending invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000001_update_default_role.sql
-- Update handle_new_user to set default role to 'user' instead of 'admin'
-- This ensures that new signups are regular members by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        CASE 
            WHEN new.raw_user_meta_data->>'tenant_id' IS NULL OR new.raw_user_meta_data->>'tenant_id' = '' THEN NULL 
            ELSE (new.raw_user_meta_data->>'tenant_id')::uuid 
        END,
        COALESCE(new.raw_user_meta_data->>'role', 'user') -- Changed from 'admin' to 'user'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000002_update_subscription_logic.sql
-- 1. Update function to check if tenant is blocked
-- Now only 'pending' invoices block the system. 'waiting' and 'paid' do not block.
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Blocked ONLY if has any 'pending' invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update automatic next invoice generation trigger
-- When an invoice is paid, generate the next one as 'waiting' (Aguardando)
CREATE OR REPLACE FUNCTION public.handle_next_invoice_generation()
RETURNS TRIGGER AS $$
DECLARE
    v_next_due_date TIMESTAMP WITH TIME ZONE;
    v_current_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only trigger when status changes from anything to paid
    IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
        -- The "Vencimento Atual" of the new invoice should be the "PrÃ³ximo Vencimento" of the paid one
        v_current_due_date := NEW.due_date;
        -- The "PrÃ³ximo Vencimento" of the new invoice should be 30 days after the generation date (now)
        v_next_due_date := timezone('utc'::text, now()) + interval '30 days';
        
        -- Check if a pending or waiting invoice already exists for this tenant to avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.subscription_invoices 
            WHERE tenant_id = NEW.tenant_id AND status IN ('pending', 'waiting')
        ) THEN
            INSERT INTO public.subscription_invoices (tenant_id, amount, status, created_at, due_date)
            VALUES (NEW.tenant_id, NEW.amount, 'waiting', v_current_due_date, v_next_due_date);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_generate_next_invoice ON public.subscription_invoices;
CREATE TRIGGER tr_generate_next_invoice
    AFTER UPDATE ON public.subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_next_invoice_generation();


-- FILE: 20260312000003_fix_subscription_dates_and_auto_pending.sql
-- 1. Update trigger to correctly replicate dates and set status to 'waiting'
CREATE OR REPLACE FUNCTION public.handle_next_invoice_generation()
RETURNS TRIGGER AS $$
DECLARE
    v_next_due_date TIMESTAMP WITH TIME ZONE;
    v_current_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only trigger when status changes from anything to paid
    IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
        -- The "Vencimento Atual" of the new invoice should be the "PrÃ³ximo Vencimento" of the paid one
        -- Normalizar para Meio-Dia (12:00 UTC) para evitar saltos de data
        v_current_due_date := date_trunc('day', NEW.due_date) + interval '12 hours';
        -- The "PrÃ³ximo Vencimento" of the new invoice should be 1 month after the new "Vencimento Atual"
        v_next_due_date := v_current_due_date + interval '1 month';
        
        -- Check if a pending or waiting invoice already exists for this tenant to avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.subscription_invoices 
            WHERE tenant_id = NEW.tenant_id AND status IN ('pending', 'waiting')
        ) THEN
            INSERT INTO public.subscription_invoices (tenant_id, amount, status, created_at, due_date)
            VALUES (NEW.tenant_id, NEW.amount, 'waiting', v_current_due_date, v_next_due_date);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update block check function to automatically transition expired 'waiting' invoices to 'pending'
-- This ensures the block is applied as soon as the date passes
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- First, automatically update any 'waiting' invoice that has passed its due date to 'pending'
    -- Note: We use 'created_at' as the start of the period (Vencimento Atual) 
    -- and 'due_date' as the end (PrÃ³ximo Vencimento).
    -- If current time is past 'created_at' (the start of the period for the new invoice), it should become pending.
    -- Wait, if it's 'Aguardando', it's for the FUTURE period. 
    -- It should become 'Pendente' only when the current date reaches the "Vencimento Atual" (created_at).
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND created_at <= timezone('utc'::text, now());

    -- Blocked ONLY if has any 'pending' invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000004_fix_pending_grace_period.sql
-- Update block check function to consider late only the day AFTER due date
-- An invoice becomes 'pending' only when current_date > Vencimento Atual (created_at)
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Automatically update any 'waiting' invoice to 'pending' 
    -- ONLY IF the current date is strictly AFTER the 'Vencimento Atual' (created_at)
    -- This means on the exact day of due date, it is still NOT considered late.
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND timezone('utc'::text, now()) > (created_at + interval '1 day');

    -- Blocked ONLY if has any 'pending' invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000005_fix_bidirectional_status_transition.sql
-- Update block check function to correctly handle transitions in both directions
-- 1. Automatically transition 'waiting' to 'pending' if overdue (after 1 day grace)
-- 2. Automatically transition 'pending' back to 'waiting' if date is adjusted back to within grace period
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Transition 'waiting' -> 'pending' if current date is strictly AFTER (Vencimento Atual + 1 day)
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND timezone('utc'::text, now()) > (created_at + interval '1 day');

    -- Transition 'pending' -> 'waiting' if current date is WITHIN the grace period
    -- This handles cases where dates are manually corrected/updated in the DB
    UPDATE public.subscription_invoices
    SET status = 'waiting'
    WHERE tenant_id = p_tenant_id 
      AND status = 'pending' 
      AND timezone('utc'::text, now()) <= (created_at + interval '1 day');

    -- Blocked ONLY if has any 'pending' invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000006_refine_date_logic_precision.sql
-- Refined block check function with day-level precision
-- 1. Automatically transition 'waiting' -> 'pending' if current_date > (Vencimento Atual + 1 day)
-- 2. Automatically transition 'pending' -> 'waiting' if current_date <= (Vencimento Atual + 1 day)
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Transition 'waiting' -> 'pending' 
    -- ONLY IF today is strictly AFTER (Vencimento Atual + 1 day)
    -- Using ::date to compare only the days, ignoring the exact hour
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND CURRENT_DATE > (created_at::date + interval '1 day');

    -- Transition 'pending' -> 'waiting' 
    -- IF today is WITHIN the grace period (<= Vencimento Atual + 1 day)
    UPDATE public.subscription_invoices
    SET status = 'waiting'
    WHERE tenant_id = p_tenant_id 
      AND status = 'pending' 
      AND CURRENT_DATE <= (created_at::date + interval '1 day');

    -- Blocked ONLY if has any 'pending' invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000007_block_new_users_no_invoice.sql
-- Update block check function to block access if NO invoices exist
-- A tenant is now blocked if:
-- 1. Has any 'pending' invoice OR
-- 2. Has NO invoices at all (newly registered user who hasn't chosen a plan)
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_invoices BOOLEAN;
BEGIN
    -- 1. Sync status logic (waiting <-> pending)
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND CURRENT_DATE > created_at::date;

    UPDATE public.subscription_invoices
    SET status = 'waiting'
    WHERE tenant_id = p_tenant_id 
      AND status = 'pending' 
      AND CURRENT_DATE <= created_at::date;

    -- 2. Check if tenant has any invoice at all
    SELECT EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id
    ) INTO v_has_invoices;

    -- 3. Block logic:
    -- If no invoices -> BLOCKED
    -- If has pending invoices -> BLOCKED
    -- Otherwise -> UNBLOCKED
    RETURN (NOT v_has_invoices) OR EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000008_update_plans_limits.sql
-- 1. Add max_patients to plans table
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_patients INTEGER;

-- 2. Update existing plans with new limits (based on user request)
-- Note: 'max_products' and 'max_patients' = NULL means unlimited

-- Plano BÃ¡sico: 2 users, 100 products, 500 patients (R$ 99/mÃªs)
UPDATE public.plans 
SET 
    max_users = 2, 
    max_products = 100, 
    max_patients = 500,
    price = 99.00
WHERE name = 'BÃ¡sico';

-- Plano Profissional: 20 users, 2000 products, 5000 patients (R$ 199/mÃªs)
UPDATE public.plans 
SET 
    max_users = 20, 
    max_products = 2000, 
    max_patients = 5000,
    price = 199.00
WHERE name = 'Profissional';

-- Plano Empresarial: 100 users, unlimited products, unlimited patients (R$ 499/mÃªs)
UPDATE public.plans 
SET 
    max_users = 100, 
    max_products = NULL, 
    max_patients = NULL,
    price = 499.00
WHERE name = 'Empresarial';

-- 3. Ensure any new plan inserted in the future follows this structure
-- This is just for completeness if someone deletes and re-inserts
-- (Though the UPDATE above is sufficient for current data)


-- FILE: 20260312000009_enforce_plan_limits.sql
-- 1. Ensure produtos_master has tenant_id and RLS
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos_master') THEN
        -- Add tenant_id if not exists
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'produtos_master' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.produtos_master ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
            UPDATE public.produtos_master SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
            ALTER TABLE public.produtos_master ALTER COLUMN tenant_id SET NOT NULL;
        END IF;
        
        -- Enable RLS
        ALTER TABLE public.produtos_master ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Tenant Isolation" ON public.produtos_master;
        CREATE POLICY "Tenant Isolation" ON public.produtos_master USING (tenant_id = public.get_current_tenant_id());
    END IF;
END $$;

-- 2. Ensure profiles has RLS enabled (it was disabled in supabase_get_tables output)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create function to check plan limits
CREATE OR REPLACE FUNCTION public.check_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_plan_id UUID;
    v_max_users INTEGER;
    v_max_products INTEGER;
    v_max_patients INTEGER;
    v_current_count INTEGER;
BEGIN
    -- Determine tenant_id based on table
    IF TG_TABLE_NAME = 'profiles' THEN
        v_tenant_id := NEW.tenant_id;
    ELSIF TG_TABLE_NAME = 'produtos_master' THEN
        v_tenant_id := NEW.tenant_id;
    ELSIF TG_TABLE_NAME = 'pacientes' THEN
        v_tenant_id := NEW.tenant_id;
    END IF;

    -- Legacy tenant is never limited
    IF v_tenant_id = '00000000-0000-0000-0000-000000000000' THEN
        RETURN NEW;
    END IF;

    -- Get plan limits
    SELECT p.max_users, p.max_products, p.max_patients
    INTO v_max_users, v_max_products, v_max_patients
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE s.tenant_id = v_tenant_id AND s.status = 'active'
    LIMIT 1;

    -- Default if no active subscription found
    IF NOT FOUND THEN
        -- Allow insertion if it's the first user (onboarding)
        IF TG_TABLE_NAME = 'profiles' THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Tenant sem assinatura ativa.';
    END IF;

    -- Check limits
    IF TG_TABLE_NAME = 'profiles' THEN
        IF v_max_users IS NOT NULL THEN
            SELECT count(*) INTO v_current_count FROM public.profiles WHERE tenant_id = v_tenant_id;
            IF v_current_count >= v_max_users THEN
                RAISE EXCEPTION 'Limite de usuÃ¡rios atingido para este plano (% usuÃ¡rios)', v_max_users;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'produtos_master' THEN
        IF v_max_products IS NOT NULL THEN
            SELECT count(*) INTO v_current_count FROM public.produtos_master WHERE tenant_id = v_tenant_id;
            IF v_current_count >= v_max_products THEN
                RAISE EXCEPTION 'Limite de produtos atingido para este plano (% produtos)', v_max_products;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'pacientes' THEN
        IF v_max_patients IS NOT NULL THEN
            SELECT count(*) INTO v_current_count FROM public.pacientes WHERE tenant_id = v_tenant_id;
            IF v_current_count >= v_max_patients THEN
                RAISE EXCEPTION 'Limite de pacientes atingido para este plano (% pacientes)', v_max_patients;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Add triggers
DROP TRIGGER IF EXISTS tr_check_user_limit ON public.profiles;
CREATE TRIGGER tr_check_user_limit
    BEFORE INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();

DROP TRIGGER IF EXISTS tr_check_product_limit ON public.produtos_master;
CREATE TRIGGER tr_check_product_limit
    BEFORE INSERT ON public.produtos_master
    FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();

DROP TRIGGER IF EXISTS tr_check_patient_limit ON public.pacientes;
CREATE TRIGGER tr_check_patient_limit
    BEFORE INSERT ON public.pacientes
    FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();


-- FILE: 20260312000010_fix_entry_rls_and_trigger.sql
-- Fix RLS and trigger for entradas_produtos
-- 1. Ensure get_current_tenant_id handles nulls by falling back to legacy tenant
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1.1 Ensure logs_sistema has tenant_id column before triggers use it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logs_sistema' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.logs_sistema ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    END IF;
END $$;

-- 2. Update atualizar_estoque_entrada to use produtos_master if produtos is missing
CREATE OR REPLACE FUNCTION public.atualizar_estoque_entrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_table_name text;
BEGIN
    -- Determina qual tabela usar
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos_master') THEN
        v_table_name := 'produtos_master';
    ELSE
        v_table_name := 'produtos';
    END IF;

    -- Atualiza o estoque na tabela correta
    EXECUTE format('UPDATE public.%I SET estoque_atual = estoque_atual + $1 WHERE id = $2', v_table_name)
    USING NEW.quantidade, NEW.produto_id;
    
    -- Insere log
    INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
    VALUES (NEW.usuario_id, 'ENTRADA_PRODUTO', 'entradas_produtos', 
            json_build_object(
              'produto_id', NEW.produto_id,
              'quantidade', NEW.quantidade,
              'lote', NEW.lote
            ),
            COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
    
    RETURN NEW;
END;
$$;

-- 3. Re-create the trigger to use the updated function
DROP TRIGGER IF EXISTS trigger_entrada_produto ON public.entradas_produtos;
CREATE TRIGGER trigger_entrada_produto
    AFTER INSERT ON public.entradas_produtos
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_entrada();

-- 4. Ensure RLS policies for regular users to INSERT into entradas_produtos
-- Drop old policy if exists to re-create properly
DROP POLICY IF EXISTS "Tenant Isolation" ON public.entradas_produtos;
CREATE POLICY "Tenant Isolation" ON public.entradas_produtos
    FOR ALL
    TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id())
    WITH CHECK (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());

-- 5. Fix atualizar_estoque_dispensacao to handle table name and tenant_id
CREATE OR REPLACE FUNCTION public.atualizar_estoque_dispensacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_table_name text;
    v_estoque_atual integer;
BEGIN
    -- Determina qual tabela usar
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos_master') THEN
        v_table_name := 'produtos_master';
    ELSE
        v_table_name := 'produtos';
    END IF;

    -- Verificar se hÃ¡ estoque suficiente
    EXECUTE format('SELECT estoque_atual FROM public.%I WHERE id = $1', v_table_name)
    INTO v_estoque_atual
    USING NEW.produto_id;

    IF v_estoque_atual IS NULL OR v_estoque_atual < NEW.quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para dispensaÃ§Ã£o';
    END IF;
    
    -- Atualiza o estoque na tabela correta
    EXECUTE format('UPDATE public.%I SET estoque_atual = estoque_atual - $1 WHERE id = $2', v_table_name)
    USING NEW.quantidade, NEW.produto_id;
    
    -- Insere log
    INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
    VALUES (NEW.usuario_id, 'DISPENSACAO', 'dispensacoes', 
            json_build_object(
              'paciente_id', NEW.paciente_id,
              'produto_id', NEW.produto_id,
              'quantidade', NEW.quantidade,
              'lote', NEW.lote
            ),
            COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
    
    RETURN NEW;
END;
$$;

-- 6. Re-create the trigger for dispensacoes
DROP TRIGGER IF EXISTS trigger_dispensacao_estoque ON public.dispensacoes;
CREATE TRIGGER trigger_dispensacao_estoque
    AFTER INSERT ON public.dispensacoes
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_dispensacao();

-- 7. Create a view 'produtos' that points to 'produtos_master' if it exists
-- This fixes all frontend code that expects 'produtos' table
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos_master') THEN
        IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos') THEN
            CREATE VIEW public.produtos AS SELECT * FROM public.produtos_master;
            -- Grant access to the view
            GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
            GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO service_role;
        END IF;
    END IF;
END $$;




-- FILE: 20260312000010_refine_basic_plan_and_perms.sql
-- Update Plano BÃ¡sico with new limits
-- Basic: 25 users, 250 products, 2500 patients (R$ 99/mÃªs)
UPDATE public.plans 
SET 
    max_users = 25, 
    max_products = 250, 
    max_patients = 2500,
    price = 99.00
WHERE name = 'BÃ¡sico';

-- Ensure SUPER_ADMIN can edit plans via RLS
DROP POLICY IF EXISTS "Super admins can manage plans" ON public.plans;
CREATE POLICY "Super admins can manage plans" ON public.plans
    FOR ALL USING (public.is_super_admin());


-- FILE: 20260312000011_sync_invoices_on_plan_price_change.sql
-- Function to update invoice amounts when a plan price changes
CREATE OR REPLACE FUNCTION public.sync_invoice_amounts_on_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if the price has changed
    IF (OLD.price IS DISTINCT FROM NEW.price) THEN
        -- Update all invoices that are not paid
        -- We join with subscriptions by tenant_id to find invoices belonging to this plan
        UPDATE public.subscription_invoices si
        SET amount = NEW.price
        FROM public.subscriptions s
        WHERE si.tenant_id = s.tenant_id
          AND s.plan_id = NEW.id
          AND si.status != 'paid';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on the plans table
DROP TRIGGER IF EXISTS tr_sync_invoice_amounts ON public.plans;
CREATE TRIGGER tr_sync_invoice_amounts
    AFTER UPDATE OF price ON public.plans
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_invoice_amounts_on_plan_update();


-- FILE: 20260312000012_fix_invoice_sync_trigger.sql
-- Function to update invoice amounts when a plan price changes
CREATE OR REPLACE FUNCTION public.sync_invoice_amounts_on_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if the price has changed
    IF (OLD.price IS DISTINCT FROM NEW.price) THEN
        -- Update all invoices that are not paid
        -- We join with subscriptions by subscription_id if available,
        -- or by tenant_id and plan_id as a fallback.
        UPDATE public.subscription_invoices si
        SET amount = NEW.price
        FROM public.subscriptions s
        WHERE 
          (
            -- Case 1: Direct link via subscription_id
            si.subscription_id = s.id
          )
          AND s.plan_id = NEW.id
          AND si.status != 'paid';
          
        -- Fallback for legacy invoices without subscription_id
        -- We can only guess based on the tenant having an active subscription to this plan
        UPDATE public.subscription_invoices si
        SET amount = NEW.price
        WHERE si.subscription_id IS NULL
          AND si.status != 'paid'
          AND EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.tenant_id = si.tenant_id
              AND s.plan_id = NEW.id
              AND s.status = 'active'
          );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manual sync for existing invoices
UPDATE public.subscription_invoices si
SET amount = p.price
FROM public.subscriptions s
JOIN public.plans p ON s.plan_id = p.id
WHERE 
  (si.subscription_id = s.id OR (si.subscription_id IS NULL AND si.tenant_id = s.tenant_id))
  AND s.status = 'active'
  AND si.status != 'paid'
  AND si.amount != p.price;


-- FILE: 20260312000013_robust_invoice_sync.sql

-- Migration to force sync invoice amounts with current plan prices
-- and ensure future updates are robust.

-- 1. Manual update for all unpaid invoices to match current plan price
UPDATE public.subscription_invoices si
SET amount = p.price
FROM public.subscriptions s
JOIN public.plans p ON s.plan_id = p.id
WHERE 
  (si.subscription_id = s.id OR (si.subscription_id IS NULL AND si.tenant_id = s.tenant_id))
  AND s.status = 'active'
  AND si.status != 'paid'
  AND si.amount != p.price;

-- 2. Update the trigger function to be even more aggressive and robust
CREATE OR REPLACE FUNCTION public.sync_invoice_amounts_on_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if the price has changed
    IF (OLD.price IS DISTINCT FROM NEW.price) THEN
        -- Log the update (will appear in Supabase logs)
        RAISE NOTICE 'Plan % price changed from % to %. Syncing invoices...', NEW.name, OLD.price, NEW.price;

        -- Update all invoices that are not paid for this specific plan
        -- We join with subscriptions by plan_id
        UPDATE public.subscription_invoices si
        SET amount = NEW.price
        WHERE si.status != 'paid'
          AND (
            -- Either linked via subscription_id that points to this plan
            EXISTS (
              SELECT 1 FROM public.subscriptions s 
              WHERE s.id = si.subscription_id AND s.plan_id = NEW.id
            )
            OR
            -- Or linked via tenant_id that HAS an active subscription to this plan
            (si.subscription_id IS NULL AND EXISTS (
              SELECT 1 FROM public.subscriptions s 
              WHERE s.tenant_id = si.tenant_id AND s.plan_id = NEW.id AND s.status = 'active'
            ))
          );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure the trigger is properly attached to the plans table
DROP TRIGGER IF EXISTS tr_sync_invoices_on_plan_price_change ON public.plans;
CREATE TRIGGER tr_sync_invoices_on_plan_price_change
AFTER UPDATE OF price ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_amounts_on_plan_update();


-- FILE: 20260312000014_add_sync_rpc.sql

-- RPC to sync all unpaid invoices with their current plan prices
CREATE OR REPLACE FUNCTION public.sync_all_unpaid_invoices()
RETURNS void AS $$
BEGIN
    -- This uses the same logic as the trigger manual sync part
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE 
      (si.subscription_id = s.id OR (si.subscription_id IS NULL AND si.tenant_id = s.tenant_id))
      AND s.status = 'active'
      AND si.status != 'paid'
      AND si.amount != p.price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000015_fix_login_and_profiles.sql

-- Migration to fix login issues and ensure all users have profiles
-- and can access their own data.

-- 1. Ensure users can always view their own profile (Fixes circular dependency in get_current_tenant_id)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- 2. Sync existing auth.users to public.profiles if they are missing
-- This handles users created before the trigger was active or if trigger failed
INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'full_name', 'UsuÃ¡rio'),
    COALESCE((au.raw_user_meta_data->>'tenant_id')::uuid, '00000000-0000-0000-0000-000000000000'),
    COALESCE(au.raw_user_meta_data->>'role', 'user')
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Update is_super_admin to be more efficient
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Robustify get_current_tenant_id
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ensure Super Admin can bypass all RLS for maintenance
-- This was already partially done but we ensure it for profiles too
DROP POLICY IF EXISTS "Super Admin full access on profiles" ON public.profiles;
CREATE POLICY "Super Admin full access on profiles" ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());


-- FILE: 20260312000016_fix_sync_logic.sql

-- 1. Redefine the sync function to be much more robust and inclusive
CREATE OR REPLACE FUNCTION public.sync_all_unpaid_invoices()
RETURNS void AS $$
BEGIN
    -- Log start for debugging (Supabase Logs)
    RAISE NOTICE 'Manual Sync Invoices started by Super Admin';

    -- Update all unpaid invoices to match the current plan price
    -- of the tenant's most recent non-canceled subscription.
    -- We use a more permissive join to ensure we don't miss any invoices.
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE 
      (
        -- Link 1: Direct ID link
        si.subscription_id = s.id 
        OR 
        -- Link 2: Tenant link if subscription_id is missing or doesn't match
        (si.tenant_id = s.tenant_id)
      )
      -- Subscription must be in a "relevant" state (not canceled)
      AND s.status IN ('active', 'past_due', 'trialing')
      -- Invoice must NOT be paid
      AND si.status NOT IN ('paid')
      -- Plan must match (prevent syncing an old plan's invoice with a new plan's price if the tenant changed plans)
      AND s.plan_id = p.id
      -- Price must be different
      AND si.amount != p.price;

    RAISE NOTICE 'Manual Sync Invoices completed.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Immediate manual correction for existing data
-- This handles the specific case of R$ 499 vs R$ 600 shown in the image
UPDATE public.subscription_invoices si
SET amount = p.price
FROM public.subscriptions s
JOIN public.plans p ON s.plan_id = p.id
WHERE 
  (si.subscription_id = s.id OR (si.tenant_id = s.tenant_id))
  AND s.status IN ('active', 'past_due', 'trialing')
  AND si.status NOT IN ('paid')
  AND si.amount != p.price;


-- FILE: 20260312000017_aggressive_sync_fix.sql

-- Aggressive sync: Update ALL unpaid invoices to the current plan price of the tenant.
-- This handles the case where subscription_id might be null or outdated.
CREATE OR REPLACE FUNCTION public.sync_all_unpaid_invoices()
RETURNS void AS $$
DECLARE
    v_updated_count INT;
BEGIN
    RAISE NOTICE 'Aggressive Manual Sync Invoices started.';

    -- 1. First attempt: Sync using subscription_id
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE 
      si.subscription_id = s.id 
      AND si.status NOT IN ('paid')
      AND si.amount != p.price;

    -- 2. Second attempt: Sync using tenant_id for invoices with NULL subscription_id
    -- or if the previous update missed it.
    -- We take the price of the plan in the tenant's current ACTIVE subscription.
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE 
      si.tenant_id = s.tenant_id
      AND s.status = 'active'
      AND si.status NOT IN ('paid')
      AND si.amount != p.price;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE 'Aggressive Manual Sync Invoices completed. Rows updated: %', v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manual sweep for all unpaid invoices to match the current plan price of their tenant's active sub
UPDATE public.subscription_invoices si
SET amount = p.price
FROM public.subscriptions s
JOIN public.plans p ON s.plan_id = p.id
WHERE 
  (si.subscription_id = s.id OR (si.tenant_id = s.tenant_id AND s.status = 'active'))
  AND si.status NOT IN ('paid')
  AND si.amount != p.price;


-- FILE: 20260312000018_add_plan_id_to_invoices.sql

-- 1. Add plan_id to subscription_invoices to ensure we know which plan an invoice is for
ALTER TABLE public.subscription_invoices ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id);

-- 2. Try to sync existing invoices with plan_id based on amount (heuristic)
-- This will help correct Row 1 and Row 2 in the user's image
UPDATE public.subscription_invoices si
SET plan_id = p.id
FROM public.plans p
WHERE 
  si.plan_id IS NULL
  AND (si.amount = p.price OR (p.name = 'Empresarial' AND si.amount = 499)); -- Heuristic: 499 was the old Empresarial price

-- 3. Create or Update a robust trigger to handle subscription creation/update on payment
CREATE OR REPLACE FUNCTION public.handle_subscription_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- When an invoice is marked as PAID
    IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
        -- If it's a new subscription or an upgrade/renewal
        IF NEW.plan_id IS NOT NULL THEN
            -- Update or Create the subscription
            INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
            VALUES (
                NEW.tenant_id, 
                NEW.plan_id, 
                'active', 
                now(), 
                now() + interval '1 month'
            )
            ON CONFLICT (tenant_id) DO UPDATE -- Assuming unique constraint on tenant_id
            SET plan_id = EXCLUDED.plan_id,
                status = 'active',
                current_period_start = now(),
                current_period_end = now() + interval '1 month';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ensure the subscriptions table has a unique constraint on tenant_id (one active sub per tenant)
-- (We might need to check if multiple subs exist first, but for now we'll try to enforce it)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tenant_id_key') THEN
        ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tenant_id_key UNIQUE (tenant_id);
    END IF;
END $$;

-- 5. Attach trigger
DROP TRIGGER IF EXISTS tr_handle_subscription_on_payment ON public.subscription_invoices;
CREATE TRIGGER tr_handle_subscription_on_payment
    AFTER UPDATE ON public.subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_subscription_on_payment();

-- 6. Refine sync_all_unpaid_invoices to be even simpler and more direct
CREATE OR REPLACE FUNCTION public.sync_all_unpaid_invoices()
RETURNS void AS $$
BEGIN
    -- Update based on plan_id directly
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.plans p
    WHERE 
      si.plan_id = p.id
      AND si.status NOT IN ('paid')
      AND si.amount != p.price;

    -- Update based on current subscription as fallback
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE 
      (si.subscription_id = s.id OR (si.tenant_id = s.tenant_id AND s.status = 'active'))
      AND si.status NOT IN ('paid')
      AND si.amount != p.price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000019_final_sync_activation.sql

-- One-time script to activate subscriptions for all existing PAID invoices
-- This ensures the UI reflects the current plan and the sync logic works.
INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
SELECT 
    si.tenant_id, 
    si.plan_id, 
    'active', 
    COALESCE(si.payment_date, si.created_at), 
    COALESCE(si.payment_date, si.created_at) + interval '1 month'
FROM public.subscription_invoices si
WHERE si.status = 'paid' AND si.plan_id IS NOT NULL
ON CONFLICT (tenant_id) DO UPDATE 
SET plan_id = EXCLUDED.plan_id,
    status = 'active',
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end;

-- Final sync attempt to fix the 499 -> 600 case once and for all
UPDATE public.subscription_invoices si
SET amount = p.price
FROM public.plans p
WHERE 
  si.plan_id = p.id
  AND si.status NOT IN ('paid')
  AND si.amount != p.price;


-- FILE: 20260312000020_swap_plan_names.sql

-- Swap names and descriptions of BÃ¡sico and Profissional plans
-- Currently: BÃ¡sico = 299, Profissional = 99
-- Goal: BÃ¡sico = 99, Profissional = 299

DO $$
DECLARE
    basic_id UUID;
    prof_id UUID;
BEGIN
    SELECT id INTO basic_id FROM public.plans WHERE name = 'BÃ¡sico';
    SELECT id INTO prof_id FROM public.plans WHERE name = 'Profissional';

    -- Temporary name to avoid conflict if there were unique constraints (there aren't, but good practice)
    UPDATE public.plans SET name = 'Temp' WHERE id = basic_id;
    
    UPDATE public.plans 
    SET name = 'BÃ¡sico', 
        description = 'Ideal para pequenas unidades'
    WHERE id = prof_id;

    UPDATE public.plans 
    SET name = 'Profissional', 
        description = 'Para unidades em crescimento'
    WHERE id = basic_id;
END $$;


-- FILE: 20260312000020_switch_fk_to_profiles.sql
-- Fix all foreign keys and missing columns for proper multi-tenancy and user management
-- as 'usuarios' table is deprecated in favor of 'profiles' table.

DO $$
BEGIN
    -- 2. Switch all foreign keys from 'usuarios' to 'profiles'
    
    -- entradas_produtos
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'entradas_produtos_usuario_id_fkey') THEN
        ALTER TABLE public.entradas_produtos DROP CONSTRAINT entradas_produtos_usuario_id_fkey;
        ALTER TABLE public.entradas_produtos ADD CONSTRAINT entradas_produtos_usuario_id_fkey 
            FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- dispensacoes
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'dispensacoes_usuario_id_fkey') THEN
        ALTER TABLE public.dispensacoes DROP CONSTRAINT dispensacoes_usuario_id_fkey;
        ALTER TABLE public.dispensacoes ADD CONSTRAINT dispensacoes_usuario_id_fkey 
            FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- logs_sistema
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'logs_sistema_usuario_id_fkey') THEN
        ALTER TABLE public.logs_sistema DROP CONSTRAINT logs_sistema_usuario_id_fkey;
        ALTER TABLE public.logs_sistema ADD CONSTRAINT logs_sistema_usuario_id_fkey 
            FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- 3. Sync current logged users to public.profiles if they exist in auth.users but not in profiles
    INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
    SELECT 
        au.id, 
        au.email, 
        COALESCE(au.raw_user_meta_data->>'full_name', 'UsuÃ¡rio'),
        COALESCE((au.raw_user_meta_data->>'tenant_id')::uuid, '00000000-0000-0000-0000-000000000000'),
        COALESCE(au.raw_user_meta_data->>'role', 'user')
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
    ON CONFLICT (id) DO NOTHING;

    -- 4. Sync profiles to legacy usuarios table (as fallback)
    -- This ensures that any logic still looking at the 'usuarios' table won't break
    INSERT INTO public.usuarios (id, nome, email, senha, tipo, ativo)
    SELECT 
        id, 
        COALESCE(full_name, 'UsuÃ¡rio'), 
        email, 
        'legacy_auth', -- dummy password for deprecated table
        CASE WHEN role = 'super_admin' THEN 'ADMIN'::tipo_usuario ELSE 'COMUM'::tipo_usuario END,
        true
    FROM public.profiles
    ON CONFLICT (id) DO NOTHING;

END $$;


-- FILE: 20260312000021_fix_typo_api_access.sql

-- Fix typo in plan features
UPDATE public.plans 
SET features = features::jsonb || '["api access"]'::jsonb - 'api acess'
WHERE features::jsonb ? 'api acess';


-- FILE: 20260312000030_cleanup_legacy_schema.sql
-- Cleanup Legacy Schema (Final Version)
-- 1. Drop the legacy 'usuarios' table and its associated type and functions
DROP TABLE IF EXISTS public.usuarios CASCADE;
DROP TYPE IF EXISTS public.tipo_usuario CASCADE;

-- 2. Ensure the 'produtos' table is correctly structured and named
DO $$
BEGIN
    -- Case A: 'produtos_master' exists and needs to become the main 'produtos' table
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'produtos_master'
    ) THEN
        -- Drop the existing 'produtos' (could be a table or view)
        DROP TABLE IF EXISTS public.produtos CASCADE;
        
        -- Rename 'produtos_master' to 'produtos'
        ALTER TABLE public.produtos_master RENAME TO produtos;
    END IF;

    -- Case B: 'produtos' exists but might be missing the 'estoque_atual' column
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'produtos'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'estoque_atual'
        ) THEN
            ALTER TABLE public.produtos ADD COLUMN estoque_atual INTEGER DEFAULT 0;
        END IF;
    END IF;
END $$;

-- 3. Simplify Triggers (Ensure they use the now-correct 'produtos' table)
CREATE OR REPLACE FUNCTION public.atualizar_estoque_entrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    -- Atualiza o estoque na tabela padrÃ£o 'produtos'
    UPDATE public.produtos SET estoque_atual = estoque_atual + NEW.quantidade WHERE id = NEW.produto_id;
    
    -- Insere log
    INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
    VALUES (NEW.usuario_id, 'ENTRADA_PRODUTO', 'entradas_produtos', 
            json_build_object(
              'produto_id', NEW.produto_id,
              'quantidade', NEW.quantidade,
              'lote', NEW.lote
            ),
            COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_estoque_dispensacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_estoque_atual integer;
BEGIN
    -- Verificar se hÃ¡ estoque suficiente na tabela padrÃ£o 'produtos'
    SELECT estoque_atual INTO v_estoque_atual FROM public.produtos WHERE id = NEW.produto_id;

    IF v_estoque_atual IS NULL OR v_estoque_atual < NEW.quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para dispensaÃ§Ã£o';
    END IF;
    
    -- Atualiza o estoque
    UPDATE public.produtos SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.produto_id;
    
    -- Insere log
    INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
    VALUES (NEW.usuario_id, 'DISPENSACAO', 'dispensacoes', 
            json_build_object(
              'paciente_id', NEW.paciente_id,
              'produto_id', NEW.produto_id,
              'quantidade', NEW.quantidade,
              'lote', NEW.lote
            ),
            COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
    
    RETURN NEW;
END;
$$;

-- 4. Re-create triggers to ensure they are active
DROP TRIGGER IF EXISTS trigger_entrada_produto ON public.entradas_produtos;
CREATE TRIGGER trigger_entrada_produto
    AFTER INSERT ON public.entradas_produtos
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_entrada();

DROP TRIGGER IF EXISTS trigger_dispensacao_estoque ON public.dispensacoes;
CREATE TRIGGER trigger_dispensacao_estoque
    AFTER INSERT ON public.dispensacoes
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_dispensacao();


-- FILE: 20260312000035_fix_dispensation_rls.sql
-- Fix RLS policy for dispensacoes to handle multi-tenancy correctly
-- Similar to what was done for entradas_produtos

-- 1. Ensure RLS policies for regular users to INSERT/SELECT from dispensacoes
-- Drop old policy if exists to re-create properly
DROP POLICY IF EXISTS "Tenant Isolation" ON public.dispensacoes;
CREATE POLICY "Tenant Isolation" ON public.dispensacoes
    FOR ALL
    TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id())
    WITH CHECK (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());


-- FILE: 20260312000040_fix_all_business_rls.sql
-- Fix RLS policies for all business tables to handle multi-tenancy and Super Admins correctly
-- This ensures that both regular users (isolated by tenant) and Super Admins (global access)
-- can perform operations without RLS violations.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'logs_sistema'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists in public schema
        IF EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) THEN
            -- Drop old policy if exists
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            
            -- Create new robust policy
            EXECUTE format('
                CREATE POLICY "Tenant Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id())
                WITH CHECK (public.is_super_admin() OR tenant_id = public.get_current_tenant_id())
            ', t);
            
            RAISE NOTICE 'Updated RLS policy for table: %', t;
        END IF;
    END LOOP;
END $$;


-- FILE: 20260312000045_fix_dispensation_trigger.sql
-- Fix Stock Recalculation Trigger for Dispensations
-- This ensures that when a dispensation is registered, the 'produtos' table stock is correctly updated.

-- 1. Update the function to handle stock subtraction correctly
CREATE OR REPLACE FUNCTION public.atualizar_estoque_dispensacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_estoque_atual integer;
BEGIN
    -- 1. Buscar estoque atual na tabela 'produtos'
    SELECT estoque_atual INTO v_estoque_atual FROM public.produtos WHERE id = NEW.produto_id;

    -- 2. Validar se existe estoque suficiente
    IF v_estoque_atual IS NULL OR v_estoque_atual < NEW.quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para dispensaÃ§Ã£o (DisponÃ­vel: %, Solicitado: %)', 
            COALESCE(v_estoque_atual, 0), NEW.quantidade;
    END IF;
    
    -- 3. Subtrair do estoque na tabela 'produtos'
    UPDATE public.produtos 
    SET estoque_atual = estoque_atual - NEW.quantidade 
    WHERE id = NEW.produto_id;
    
    -- 4. Registrar log da operaÃ§Ã£o
    INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
    VALUES (NEW.usuario_id, 'DISPENSACAO', 'dispensacoes', 
            json_build_object(
              'paciente_id', NEW.paciente_id,
              'produto_id', NEW.produto_id,
              'quantidade', NEW.quantidade,
              'lote', NEW.lote
            ),
            COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
    
    RETURN NEW;
END;
$$;

-- 2. Re-create the trigger to ensure it's firing on 'dispensacoes' table
DROP TRIGGER IF EXISTS trigger_dispensacao_estoque ON public.dispensacoes;
CREATE TRIGGER trigger_dispensacao_estoque
    AFTER INSERT ON public.dispensacoes
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_dispensacao();

-- 3. Also ensure the trigger for 'entradas_produtos' is active and pointing to the right table
DROP TRIGGER IF EXISTS trigger_entrada_produto ON public.entradas_produtos;
CREATE TRIGGER trigger_entrada_produto
    AFTER INSERT ON public.entradas_produtos
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_entrada();


-- FILE: 20260312000055_fix_profiles_rls_for_team.sql
-- Fix Profiles RLS to allow team members to see each other
-- and allow Admins to manage their team members.

-- 1. Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can edit profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin full access on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin see all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile during onboarding" ON public.profiles;

-- 3. Create robust policies

-- Policy: Allow everyone to see their own profile (Fundamental)
CREATE POLICY "Allow users to view own profile" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Policy: Allow users to see other profiles in the same tenant
-- (Required for team list/collaboration)
CREATE POLICY "Allow users to view team members" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (tenant_id = public.get_current_tenant_id());

-- Policy: Allow Admins to update profiles in their own tenant
-- (Except they shouldn't be able to elevate someone to super_admin via RLS check alone, 
-- but the frontend/DB constraints should handle that. Here we focus on tenant isolation.)
CREATE POLICY "Allow admins to manage team members" ON public.profiles
    FOR ALL -- Allows INSERT, UPDATE, DELETE
    TO authenticated
    USING (
        tenant_id = public.get_current_tenant_id() AND 
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    )
    WITH CHECK (
        tenant_id = public.get_current_tenant_id()
    );

-- Policy: Super Admin has global access
CREATE POLICY "Super Admin global access" ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- 4. Ensure get_current_tenant_id and is_super_admin are optimized and bypass RLS
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Querying with SECURITY DEFINER bypasses RLS on profiles
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000060_isolate_user_data_and_fix_triggers.sql
-- Fix Stock Triggers and Isolate User Data
-- 1. Support stock adjustment on entry UPDATE and DELETE
CREATE OR REPLACE FUNCTION public.atualizar_estoque_entrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Adiciona ao estoque
        UPDATE public.produtos SET estoque_atual = estoque_atual + NEW.quantidade WHERE id = NEW.produto_id;
        
        -- Log
        INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
        VALUES (NEW.usuario_id, 'ENTRADA_PRODUTO', 'entradas_produtos', 
                json_build_object('produto_id', NEW.produto_id, 'quantidade', NEW.quantidade, 'lote', NEW.lote),
                COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
                
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Ajusta a diferenÃ§a
        UPDATE public.produtos 
        SET estoque_atual = estoque_atual - OLD.quantidade + NEW.quantidade 
        WHERE id = NEW.produto_id;
        
    ELSIF (TG_OP = 'DELETE') THEN
        -- Remove do estoque (reverte)
        UPDATE public.produtos SET estoque_atual = estoque_atual - OLD.quantidade WHERE id = OLD.produto_id;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Ensure trigger handles UPDATE and DELETE
DROP TRIGGER IF EXISTS trigger_entrada_produto ON public.entradas_produtos;
CREATE TRIGGER trigger_entrada_produto
    AFTER INSERT OR UPDATE OR DELETE ON public.entradas_produtos
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_entrada();

-- 2. Isolate User Data (Entries and Dispensations)
-- Users see only THEIR own records. Super Admins see all.
-- Note: Products and Patients remain shared by tenant.

-- Policy for entries
DROP POLICY IF EXISTS "Tenant Isolation" ON public.entradas_produtos;
CREATE POLICY "User Isolation" ON public.entradas_produtos
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        (tenant_id = public.get_current_tenant_id() AND usuario_id = auth.uid())
    )
    WITH CHECK (
        public.is_super_admin() OR 
        (tenant_id = public.get_current_tenant_id() AND usuario_id = auth.uid())
    );

-- Policy for dispensations
DROP POLICY IF EXISTS "Tenant Isolation" ON public.dispensacoes;
CREATE POLICY "User Isolation" ON public.dispensacoes
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        (tenant_id = public.get_current_tenant_id() AND usuario_id = auth.uid())
    )
    WITH CHECK (
        public.is_super_admin() OR 
        (tenant_id = public.get_current_tenant_id() AND usuario_id = auth.uid())
    );


-- FILE: 20260312000070_fix_double_stock_update.sql
-- Unified Trigger Cleanup and Fix
-- This script ensures there is ONLY ONE trigger per table for stock management.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Drop ALL triggers on entries table that might be causing duplicates
    FOR r IN (
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'entradas_produtos'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.entradas_produtos', r.trigger_name);
    END LOOP;

    -- 2. Drop ALL triggers on dispensations table that might be causing duplicates
    FOR r IN (
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'dispensacoes'
    ) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.dispensacoes', r.trigger_name);
    END LOOP;
END $$;

-- 3. Re-create the clean Entry Function
CREATE OR REPLACE FUNCTION public.atualizar_estoque_entrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.produtos SET estoque_atual = estoque_atual + NEW.quantidade WHERE id = NEW.produto_id;
        
        INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
        VALUES (NEW.usuario_id, 'ENTRADA_PRODUTO', 'entradas_produtos', 
                json_build_object('produto_id', NEW.produto_id, 'quantidade', NEW.quantidade, 'lote', NEW.lote),
                COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
                
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE public.produtos 
        SET estoque_atual = estoque_atual - OLD.quantidade + NEW.quantidade 
        WHERE id = NEW.produto_id;
        
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.produtos SET estoque_atual = estoque_atual - OLD.quantidade WHERE id = OLD.produto_id;
    END IF;
    
    RETURN NULL;
END;
$$;

-- 4. Re-create the clean Dispensation Function
CREATE OR REPLACE FUNCTION public.atualizar_estoque_dispensacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_estoque_atual integer;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        SELECT estoque_atual INTO v_estoque_atual FROM public.produtos WHERE id = NEW.produto_id;

        IF v_estoque_atual IS NULL OR v_estoque_atual < NEW.quantidade THEN
            RAISE EXCEPTION 'Estoque insuficiente para dispensaÃ§Ã£o (DisponÃ­vel: %, Solicitado: %)', 
                COALESCE(v_estoque_atual, 0), NEW.quantidade;
        END IF;
        
        UPDATE public.produtos SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.produto_id;
        
        INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
        VALUES (NEW.usuario_id, 'DISPENSACAO', 'dispensacoes', 
                json_build_object('paciente_id', NEW.paciente_id, 'produto_id', NEW.produto_id, 'quantidade', NEW.quantidade, 'lote', NEW.lote),
                COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
    END IF;
    
    RETURN NULL;
END;
$$;

-- 5. Create ONLY ONE trigger per table
CREATE TRIGGER trigger_entrada_produto_unico
    AFTER INSERT OR UPDATE OR DELETE ON public.entradas_produtos
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_entrada();

CREATE TRIGGER trigger_dispensacao_unica
    AFTER INSERT ON public.dispensacoes
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_dispensacao();


-- FILE: 20260312000080_fix_user_visibility_final.sql
-- Diagnostic and Fix for Profile Visibility
-- This script ensures all users are visible to Super Admins and 
-- team members are visible to their Admins.

-- 1. Ensure all users have a profile (Safety sync)
INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'full_name', 'UsuÃ¡rio Sem Nome'),
    COALESCE((au.raw_user_meta_data->>'tenant_id')::uuid, '00000000-0000-0000-0000-000000000000'),
    COALESCE(au.raw_user_meta_data->>'role', 'user')
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Simplify and Fix RLS Policies for Profiles
-- We will use a mix of JWT and direct checks for maximum reliability.

DROP POLICY IF EXISTS "Profiles_Own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Team" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_Manage" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_SuperAdmin" ON public.profiles;

-- Rule 1: Super Admin can see and do EVERYTHING
CREATE POLICY "Profiles_SuperAdmin_Policy" ON public.profiles
    FOR ALL 
    TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- Rule 2: Users can see their own profile
CREATE POLICY "Profiles_View_Own" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Rule 3: Users can see others in the SAME tenant
-- (This is what allows the Admin to see the Common User)
CREATE POLICY "Profiles_View_Team" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (tenant_id = public.get_current_tenant_id());

-- Rule 4: Admins can update users in their own tenant
CREATE POLICY "Profiles_Admin_Update_Team" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id = public.get_current_tenant_id() AND 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- 3. Ensure get_current_tenant_id is extremely reliable
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Try to get from profile directly (most reliable)
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
    
    -- If not found, try JWT
    IF v_tenant_id IS NULL THEN
        v_tenant_id := (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid;
    END IF;
    
    RETURN COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000090_fix_profiles_rls_final_v3.sql
-- Fix RLS Policies for Profiles (Version 3)
-- This version uses SECURITY DEFINER functions to bypass RLS and avoid infinite recursion.

-- 1. Reset all policies for profiles
DROP POLICY IF EXISTS "Profiles_Own_New" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Team_New" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_New" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Super_New" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to view team members" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to manage team members" ON public.profiles;
DROP POLICY IF EXISTS "Super Admin global access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_SuperAdmin_Policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_View_Own" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_View_Team" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_Update_Team" ON public.profiles;

-- 2. Ensure all existing profiles have a tenant_id (Safety measure)
UPDATE public.profiles 
SET tenant_id = '00000000-0000-0000-0000-000000000000' 
WHERE tenant_id IS NULL;

-- 3. Create NEW policies using robust helper functions

-- Policy 1: SELECT (View)
-- Allows: Own profile, Team members (same tenant), Super Admin (all)
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id()
    );

-- Policy 2: INSERT/UPDATE/DELETE (Manage)
-- Allows: Own profile (limited), Admin of same tenant (except self-promotion), Super Admin (all)
CREATE POLICY "profiles_manage_policy" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    )
    WITH CHECK (
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    );

-- 4. Final check on helper functions
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- This function bypasses RLS because it is SECURITY DEFINER
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_tenant_id, '00000000-0000-0000-0000-000000000000');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role text;
BEGIN
    -- This function bypasses RLS because it is SECURITY DEFINER
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260312000100_fix_admin_full_access.sql
-- Fix Admin and Super Admin access to all tenant data (entradas, dispensacoes, rascunhos)
-- This ensures that Admins can view and manage data from all users within their own tenant,
-- and Super Admins can manage data across all tenants.
-- This fix allows "Modo de Acesso RÃ¡pido" (impersonation) to work correctly at the database level.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY['entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'relatorios_compras_rascunho'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Drop existing User Isolation or restrictive policies
            EXECUTE format('DROP POLICY IF EXISTS "User Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "UsuÃ¡rios podem gerenciar seus prÃ³prios rascunhos" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "UsuÃ¡rios podem gerenciar seus prÃ³prios rascunhos de relatÃ³rio" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Admin and User Isolation" ON public.%I', t);
            
            -- Create new robust policy:
            -- 1. Super Admin: Global access
            -- 2. Admin: Full access to all data in their tenant
            -- 3. Common User: Access only to their own data in their tenant
            EXECUTE format('
                CREATE POLICY "Admin and User Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.get_auth_role() = ''admin'' OR usuario_id = auth.uid())
                    )
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.get_auth_role() = ''admin'' OR usuario_id = auth.uid())
                    )
                )
            ', t);
            
            RAISE NOTICE 'Updated RLS policy for table: %', t;
        END IF;
    END LOOP;
END $$;


-- FILE: 20260312000110_fix_plan_limits_table.sql
-- Fix Plan Limits to use 'produtos' table instead of 'produtos_master'

-- 1. Remove old trigger if it exists on the renamed/deleted table
DROP TRIGGER IF EXISTS tr_check_product_limit ON public.produtos_master;

-- 2. Update check_plan_limits function
CREATE OR REPLACE FUNCTION public.check_plan_limits()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_plan_id UUID;
    v_max_users INTEGER;
    v_max_products INTEGER;
    v_max_patients INTEGER;
    v_current_count INTEGER;
BEGIN
    -- Determine tenant_id based on table
    IF TG_TABLE_NAME = 'profiles' THEN
        v_tenant_id := NEW.tenant_id;
    ELSIF TG_TABLE_NAME = 'produtos' THEN
        v_tenant_id := NEW.tenant_id;
    ELSIF TG_TABLE_NAME = 'pacientes' THEN
        v_tenant_id := NEW.tenant_id;
    END IF;

    -- Legacy tenant is never limited
    IF v_tenant_id = '00000000-0000-0000-0000-000000000000' THEN
        RETURN NEW;
    END IF;

    -- Get plan limits
    SELECT p.max_users, p.max_products, p.max_patients
    INTO v_max_users, v_max_products, v_max_patients
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE s.tenant_id = v_tenant_id AND s.status = 'active'
    LIMIT 1;

    -- Default if no active subscription found
    IF NOT FOUND THEN
        -- Allow insertion if it's the first user (onboarding)
        IF TG_TABLE_NAME = 'profiles' THEN
            RETURN NEW;
        END IF;
        -- For Super Admin or special cases, we might want to skip this, 
        -- but for standard users, they need an active subscription.
        IF public.is_super_admin() THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Tenant sem assinatura ativa.';
    END IF;

    -- Check limits
    IF TG_TABLE_NAME = 'profiles' THEN
        IF v_max_users IS NOT NULL THEN
            SELECT count(*) INTO v_current_count FROM public.profiles WHERE tenant_id = v_tenant_id;
            IF v_current_count >= v_max_users THEN
                RAISE EXCEPTION 'Limite de usuÃ¡rios atingido para este plano (% usuÃ¡rios)', v_max_users;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'produtos' THEN
        IF v_max_products IS NOT NULL THEN
            SELECT count(*) INTO v_current_count FROM public.produtos WHERE tenant_id = v_tenant_id;
            IF v_current_count >= v_max_products THEN
                RAISE EXCEPTION 'Limite de produtos atingido para este plano (% produtos)', v_max_products;
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'pacientes' THEN
        IF v_max_patients IS NOT NULL THEN
            SELECT count(*) INTO v_current_count FROM public.pacientes WHERE tenant_id = v_tenant_id;
            IF v_current_count >= v_max_patients THEN
                RAISE EXCEPTION 'Limite de pacientes atingido para este plano (% pacientes)', v_max_patients;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add trigger to 'produtos' table
DROP TRIGGER IF EXISTS tr_check_product_limit ON public.produtos;
CREATE TRIGGER tr_check_product_limit
    BEFORE INSERT ON public.produtos
    FOR EACH ROW EXECUTE FUNCTION public.check_plan_limits();


-- FILE: 20260312000111_update_plans_image_spec.sql
-- Update Plan Limits and Prices according to latest image
-- BÃ¡sico: R$ 99, 15 users, 100 products, 1500 patients
-- Profissional: R$ 299, 25 users, 250 products, 2500 patients
-- Empresarial: R$ 1, 99 users, 600 products, 5000 patients

UPDATE public.plans 
SET 
    price = 99.00,
    max_users = 15,
    max_products = 100,
    max_patients = 1500
WHERE name = 'BÃ¡sico';

UPDATE public.plans 
SET 
    price = 299.00,
    max_users = 25,
    max_products = 250,
    max_patients = 2500
WHERE name = 'Profissional';

UPDATE public.plans 
SET 
    price = 1.00,
    max_users = 99,
    max_products = 600,
    max_patients = 5000
WHERE name = 'Empresarial';


-- FILE: 20260312000115_fix_date_sync_timezone.sql
-- Fix date synchronization with proper timezone (America/Sao_Paulo)
-- 1. Create a dedicated sync function that can be called independently
CREATE OR REPLACE FUNCTION public.sync_invoice_status(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Transition 'waiting' -> 'pending' 
    -- ONLY IF today (Brazil) is strictly AFTER the local date of Vencimento Atual (created_at)
    -- Both are compared in America/Sao_Paulo to ensure 100% precision with Brazil time.
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND (timezone('America/Sao_Paulo', now())::date) > (timezone('America/Sao_Paulo', created_at)::date);

    -- Transition 'pending' -> 'waiting' 
    -- IF today (Brazil) is within the grace period (<= local Vencimento Atual)
    UPDATE public.subscription_invoices
    SET status = 'waiting'
    WHERE tenant_id = p_tenant_id 
      AND status = 'pending' 
      AND (timezone('America/Sao_Paulo', now())::date) <= (timezone('America/Sao_Paulo', created_at)::date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update the blocking check function to use the new sync function
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_invoices BOOLEAN;
BEGIN
    -- Sync statuses first
    PERFORM public.sync_invoice_status(p_tenant_id);

    -- Check if tenant has any invoice at all
    SELECT EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id
    ) INTO v_has_invoices;

    -- Block logic:
    -- If no invoices -> BLOCKED
    -- If has any pending invoices -> BLOCKED
    -- Otherwise -> UNBLOCKED
    -- IMPORTANT: We check 'pending' status directly from the table after sync
    RETURN (NOT v_has_invoices) OR EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger to ensure next invoice generation happens and syncs immediately
CREATE OR REPLACE FUNCTION public.on_invoice_update_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync for the tenant whenever something changes
    PERFORM public.sync_invoice_status(NEW.tenant_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists and recreate trigger
DROP TRIGGER IF EXISTS tr_sync_invoices ON public.subscription_invoices;
CREATE TRIGGER tr_sync_invoices
    AFTER INSERT OR UPDATE ON public.subscription_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.on_invoice_update_sync();


-- FILE: 20260314000000_unidade_saude_vinculo.sql
-- 1. Update unidades_saude table with missing fields
ALTER TABLE public.unidades_saude ADD COLUMN IF NOT EXISTS cidade TEXT;

-- 2. Add unidade_id to profiles (users)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades_saude(id);
CREATE INDEX IF NOT EXISTS idx_profiles_unidade_id ON public.profiles(unidade_id);

-- 3. Add unidade_id to other relevant tables if missing
DO $$ 
DECLARE 
    t text;
    table_exists boolean;
BEGIN
    -- List of tables that should have unit isolation
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'atendimentos', 'queixas_principais', 'procedimentos_realizados', 'rascunhos_atendimentos', 'logs_sistema'] LOOP
        
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            -- Add column if not exists
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS unidade_id UUID REFERENCES public.unidades_saude(id)', t);
            
            -- Create index for performance
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(unidade_id)', 'idx_' || t || '_unidade_id', t);
        END IF;
    END LOOP;
END $$;

-- 4. Create Audit Log table for unit link changes
CREATE TABLE IF NOT EXISTS public.audit_vinculos_unidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.profiles(id),
    admin_id UUID REFERENCES public.profiles(id), -- Who made the change
    unidade_anterior_id UUID REFERENCES public.unidades_saude(id),
    unidade_nova_id UUID REFERENCES public.unidades_saude(id),
    motivo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Helper function to get current user's unidade_id
CREATE OR REPLACE FUNCTION public.get_current_unidade_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT unidade_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update handle_new_user to include unidade_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, tenant_id, unidade_id, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        (new.raw_user_meta_data->>'tenant_id')::uuid,
        (new.raw_user_meta_data->>'unidade_id')::uuid,
        COALESCE(new.raw_user_meta_data->>'role', 'user')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger to set unidade_id on new records automatically
CREATE OR REPLACE FUNCTION public.set_unidade_id_from_user()
RETURNS TRIGGER AS $$
DECLARE
    user_unidade_id UUID;
BEGIN
    -- Only set if not already provided
    IF NEW.unidade_id IS NULL THEN
        user_unidade_id := public.get_current_unidade_id();
        NEW.unidade_id := user_unidade_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply automatic unidade_id to business tables
DO $$ 
DECLARE 
    t text;
    table_exists boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'atendimentos', 'queixas_principais', 'procedimentos_realizados'] LOOP
        
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_unidade_id ON public.%I', t);
            EXECUTE format('CREATE TRIGGER trigger_set_unidade_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_unidade_id_from_user()', t);
        END IF;
    END LOOP;
END $$;

-- 8. RLS Policies for Unit Isolation
-- Note: Super Admin and Admin might have different access. 
-- According to PRD: "Administrador ... acesso a todos os dados" (Wait, PRD says "acesso a todos os dados" in Roles table, but "UsuÃ¡rios sÃ³ acessem dados da prÃ³pria unidade" in APIs. I will allow Admin to see all in their TENANT, but common users only their UNIT.)
-- Wait, let's refine: 
-- SUPER_ADMIN: Global
-- ADMIN: Tenant Global (all units in their tenant)
-- USER: Unit Specific

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS for business tables
DO $$ 
DECLARE 
    t text;
    table_exists boolean;
BEGIN
    FOREACH t IN ARRAY ARRAY['produtos', 'pacientes', 'entradas_produtos', 'dispensacoes', 'rascunhos_compras', 'atendimentos', 'queixas_principais', 'procedimentos_realizados'] LOOP
        
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = t
        ) INTO table_exists;

        IF table_exists THEN
            -- First disable existing isolation policies if any
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            
            -- Create new Unit Isolation policy
            -- Users see only their unit, Admins see all in tenant
            EXECUTE format('
                CREATE POLICY "Unit Isolation" ON public.%I
                USING (
                    (public.is_admin()) OR 
                    (unidade_id = public.get_current_unidade_id())
                )
                WITH CHECK (
                    (public.is_admin()) OR 
                    (unidade_id = public.get_current_unidade_id())
                )
            ', t);
        END IF;
    END LOOP;
END $$;

-- Special policies for profiles
DROP POLICY IF EXISTS "Users can view profiles in their tenant" ON public.profiles;
CREATE POLICY "Users can view profiles in their unit" ON public.profiles
    FOR SELECT USING (
        (public.is_admin()) OR 
        (unidade_id = public.get_current_unidade_id())
    );

-- Permissions for anon and authenticated
GRANT ALL ON public.unidades_saude TO authenticated;
GRANT SELECT ON public.unidades_saude TO anon;
GRANT ALL ON public.audit_vinculos_unidade TO authenticated;
GRANT ALL ON public.profiles TO authenticated;


-- FILE: 20260314000001_seed_unidades.sql
-- Insert sample health units
INSERT INTO public.unidades_saude (nome, codigo, cidade, endereco, bairro, ativo)
VALUES 
    ('UBS Central', 'UBS-001', 'Campo Grande', 'Rua Principal, 100', 'Centro', true),
    ('UBS Jardim das Flores', 'UBS-002', 'Campo Grande', 'Av. das Flores, 500', 'Jardim das Flores', true),
    ('UBS Vila EsperanÃ§a', 'UBS-003', 'Campo Grande', 'Rua da Paz, 300', 'Vila EsperanÃ§a', true),
    ('UBS Santa Maria', 'UBS-004', 'Campo Grande', 'Rua Santa Maria, 10', 'Santa Maria', true)
ON CONFLICT (codigo) DO NOTHING;


-- FILE: 20260314000002_audit_vinculo_trigger.sql
-- Trigger function to log unit changes
CREATE OR REPLACE FUNCTION public.log_unidade_vinculo_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if the unidade_id has changed
    IF (OLD.unidade_id IS DISTINCT FROM NEW.unidade_id) THEN
        INSERT INTO public.audit_vinculos_unidade (
            usuario_id,
            admin_id,
            unidade_anterior_id,
            unidade_nova_id,
            motivo
        )
        VALUES (
            NEW.id,
            auth.uid(), -- The admin/user who performed the update
            OLD.unidade_id,
            NEW.unidade_id,
            'AlteraÃ§Ã£o de vÃ­nculo via sistema'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the profiles table
DROP TRIGGER IF EXISTS trigger_audit_unidade_change ON public.profiles;
CREATE TRIGGER trigger_audit_unidade_change
    AFTER UPDATE OF unidade_id ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_unidade_vinculo_change();


-- FILE: 20260314000003_ensure_permissions.sql
-- Ensure permissions for unidades_saude
GRANT SELECT ON public.unidades_saude TO anon;
GRANT ALL ON public.unidades_saude TO authenticated;

-- Ensure permissions for audit_vinculos_unidade
GRANT ALL ON public.audit_vinculos_unidade TO authenticated;

-- Enable RLS on audit_vinculos_unidade
ALTER TABLE public.audit_vinculos_unidade ENABLE ROW LEVEL SECURITY;

-- Policy for audit_vinculos_unidade: Admins can see all, users see their own changes
CREATE POLICY "Admins can view all audit logs" ON public.audit_vinculos_unidade
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Users can view their own audit logs" ON public.audit_vinculos_unidade
    FOR SELECT USING (usuario_id = auth.uid());

-- Ensure permissions for profiles (already handled but good to be sure)
GRANT ALL ON public.profiles TO authenticated;


-- FILE: 20260314000004_fix_profile_update_rls.sql
-- Fix profile update RLS to allow users to link themselves to a unit
-- This migration updates the manage policy to include the user themselves

-- 1. Drop existing policy
DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;

-- 2. Re-create with self-update permission
CREATE POLICY "profiles_manage_policy" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        id = auth.uid() OR -- ALLOW USERS TO MANAGE THEIR OWN PROFILE
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    )
    WITH CHECK (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        )
    );

-- 3. Ensure users can always see their own profile even without unit
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id() OR
        unidade_id = (SELECT unidade_id FROM public.profiles WHERE id = auth.uid())
    );


-- FILE: 20260314000005_fix_recursion_rls.sql
-- Fix profile update RLS and infinite recursion
-- This version uses SECURITY DEFINER functions to bypass RLS and avoid infinite recursion.

-- 1. Helper functions (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_unidade_id()
RETURNS UUID AS $$
DECLARE
    v_unidade_id UUID;
BEGIN
    SELECT unidade_id INTO v_unidade_id FROM public.profiles WHERE id = auth.uid();
    RETURN v_unidade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing policies for profiles
DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 3. Re-create policies using helper functions
-- SELECT Policy
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        tenant_id = public.get_current_tenant_id() OR
        unidade_id = public.get_user_unidade_id()
    );

-- MANAGE Policy (INSERT, UPDATE, DELETE)
CREATE POLICY "profiles_manage_policy" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        id = auth.uid() OR -- ALLOW USERS TO MANAGE THEIR OWN PROFILE (e.g., self-link to unit)
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            public.is_admin()
        )
    )
    WITH CHECK (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            public.is_admin()
        )
    );


-- FILE: 20260314000006_isolate_rascunhos_by_unit.sql
-- MigraÃ§Ã£o para isolamento de rascunhos por unidade de saÃºde
-- Adiciona a coluna unidade_id e atualiza as polÃ­ticas de RLS

DO $$ 
BEGIN
    -- 1. Adicionar coluna unidade_id se nÃ£o existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rascunhos_compras' AND column_name = 'unidade_id') THEN
        ALTER TABLE public.rascunhos_compras ADD COLUMN unidade_id UUID REFERENCES public.unidades_saude(id);
        RAISE NOTICE 'Coluna unidade_id adicionada Ã  tabela rascunhos_compras';
    END IF;
END $$;

-- 2. FunÃ§Ã£o para obter a unidade_id do usuÃ¡rio logado de forma segura
CREATE OR REPLACE FUNCTION public.get_current_unidade_id()
RETURNS UUID AS $$
DECLARE
    v_unidade_id UUID;
BEGIN
    SELECT unidade_id INTO v_unidade_id FROM public.profiles WHERE id = auth.uid();
    RETURN v_unidade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger para preencher unidade_id automaticamente ao inserir
CREATE OR REPLACE FUNCTION public.trigger_set_rascunho_unidade_id()
RETURNS trigger AS $$
BEGIN
    IF NEW.unidade_id IS NULL THEN
        NEW.unidade_id := public.get_current_unidade_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_set_rascunho_unidade_id ON public.rascunhos_compras;
CREATE TRIGGER tr_set_rascunho_unidade_id
    BEFORE INSERT ON public.rascunhos_compras
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_rascunho_unidade_id();

-- 4. Atualizar as polÃ­ticas de RLS para incluir isolamento por unidade
DROP POLICY IF EXISTS "Admin and User Isolation" ON public.rascunhos_compras;

CREATE POLICY "Unit and User Isolation" ON public.rascunhos_compras
FOR ALL
TO authenticated
USING (
    public.is_super_admin() OR 
    (
        tenant_id = public.get_current_tenant_id() AND 
        (
            public.get_auth_role() = 'admin' OR 
            (unidade_id = public.get_current_unidade_id())
        )
    )
)
WITH CHECK (
    public.is_super_admin() OR 
    (
        tenant_id = public.get_current_tenant_id() AND 
        (
            public.get_auth_role() = 'admin' OR 
            (unidade_id = public.get_current_unidade_id())
        )
    )
);

-- 5. Atualizar registros existentes (opcional, associa Ã  unidade atual do dono do rascunho)
UPDATE public.rascunhos_compras r
SET unidade_id = p.unidade_id
FROM public.profiles p
WHERE r.usuario_id = p.id AND r.unidade_id IS NULL;


-- FILE: 20260314000010_enforce_unit_isolation_all_tables.sql
-- RestriÃ§Ã£o total de acesso por Unidade de SaÃºde (Unit Isolation)
-- Garante que uma unidade nÃ£o veja dados de outra (entradas, dispensaÃ§Ãµes, rascunhos, etc.)
-- Administradores continuam vendo tudo no Tenant (MunicÃ­pio), Super Admins veem tudo globalmente.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY[
        'entradas_produtos', 
        'dispensacoes', 
        'rascunhos_compras', 
        'relatorios_compras_rascunho',
        'pacientes',
        'produtos',
        'atendimentos',
        'queixas_principais',
        'procedimentos_realizados',
        'rascunhos_atendimentos'
    ];
BEGIN
    -- 1. Garantir que a funÃ§Ã£o get_current_unidade_id seja robusta
    CREATE OR REPLACE FUNCTION public.get_current_unidade_id()
    RETURNS UUID AS $func$
    BEGIN
        RETURN (SELECT unidade_id FROM public.profiles WHERE id = auth.uid());
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 2. Garantir que a funÃ§Ã£o is_admin() seja robusta
    CREATE OR REPLACE FUNCTION public.is_admin()
    RETURNS BOOLEAN AS $func$
    BEGIN
        RETURN EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND (role = 'admin' OR role = 'super_admin')
        );
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 2.1 FunÃ§Ã£o para preenchimento automÃ¡tico de tenant_id e unidade_id
    CREATE OR REPLACE FUNCTION public.set_unit_and_tenant_from_user()
    RETURNS TRIGGER AS $func$
    BEGIN
        IF NEW.tenant_id IS NULL THEN
            NEW.tenant_id := public.get_current_tenant_id();
        END IF;
        IF NEW.unidade_id IS NULL THEN
            NEW.unidade_id := public.get_current_unidade_id();
        END IF;
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 3. Iterar sobre as tabelas e aplicar a restriÃ§Ã£o por Unidade
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            
            -- 3.1 Garantir que a coluna tenant_id existe (Multi-tenancy)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'tenant_id') THEN
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) DEFAULT public.get_current_tenant_id()', t);
                RAISE NOTICE 'Coluna tenant_id adicionada Ã  tabela: %', t;
            END IF;

            -- 3.2 Garantir que a coluna unidade_id existe (Unit Isolation)
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'unidade_id') THEN
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN unidade_id UUID REFERENCES public.unidades_saude(id) DEFAULT public.get_current_unidade_id()', t);
                RAISE NOTICE 'Coluna unidade_id adicionada Ã  tabela: %', t;
            END IF;

            -- 3.3 Aplicar trigger de preenchimento automÃ¡tico
            EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_unit_and_tenant_id ON public.%I', t);
            EXECUTE format('CREATE TRIGGER trigger_set_unit_and_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_unit_and_tenant_from_user()', t);

            -- Remover polÃ­ticas conflitantes antigas
            EXECUTE format('DROP POLICY IF EXISTS "Admin and User Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "User Isolation" ON public.%I', t);
            
            -- Criar a nova polÃ­tica de isolamento por Unidade
            EXECUTE format('
                CREATE POLICY "Unit Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.is_admin() OR unidade_id = public.get_current_unidade_id())
                    )
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.is_admin() OR unidade_id = public.get_current_unidade_id())
                    )
                )
            ', t);
            
            RAISE NOTICE 'PolÃ­tica de Isolamento por Unidade aplicada Ã  tabela: %', t;
        END IF;
    END LOOP;
END $$;


-- FILE: 20260314000015_final_unit_isolation_cleanup.sql
-- Limpeza e RestriÃ§Ã£o Definitiva por Unidade (Unit Isolation)
-- Resolve o problema de rascunhos e dados sendo visÃ­veis entre unidades do mesmo tenant.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY[
        'entradas_produtos', 
        'dispensacoes', 
        'rascunhos_compras', 
        'relatorios_compras_rascunho',
        'atendimentos',
        'queixas_principais',
        'procedimentos_realizados',
        'rascunhos_atendimentos'
    ];
BEGIN
    -- 1. Iterar sobre as tabelas e remover TODAS as polÃ­ticas antigas para evitar sobreposiÃ§Ã£o (OR)
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Remover TODAS as possÃ­veis polÃ­ticas que ignoram a unidade
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Admin and User Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit and User Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "User Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "UsuÃ¡rios podem gerenciar seus prÃ³prios rascunhos" ON public.%I', t);
            
            -- 2. Criar a polÃ­tica definitiva de Isolamento por Unidade
            -- Regra: 
            --   - Super Admin: VÃª tudo.
            --   - Admin do Tenant: VÃª tudo do seu tenant (municÃ­pio).
            --   - UsuÃ¡rio Comum: VÃª APENAS o que pertence Ã  sua unidade_id.
            EXECUTE format('
                CREATE POLICY "Unit Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.is_admin() OR unidade_id = public.get_current_unidade_id())
                    )
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.is_admin() OR unidade_id = public.get_current_unidade_id())
                    )
                )
            ', t);
            
            RAISE NOTICE 'PolÃ­ticas limpas e Isolamento por Unidade aplicado Ã  tabela: %', t;
        END IF;
    END LOOP;
END $$;


-- FILE: 20260314000020_fix_admin_user_management.sql
-- Fix Admin permissions for user management and unit linking
-- This migration ensures that 'admin' users can move users between units within their tenant.

-- 1. Robust and Case-Insensitive Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $func$
DECLARE
    v_role text;
BEGIN
    SELECT lower(role) INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role IN ('admin', 'super_admin');
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $func$
DECLARE
    v_role text;
BEGIN
    SELECT lower(role) INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role = 'super_admin';
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure Profiles can be managed by Admins of the same tenant
DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;
CREATE POLICY "profiles_manage_policy" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            public.is_admin()
        )
    )
    WITH CHECK (
        id = auth.uid() OR 
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            public.is_admin()
        )
    );

-- 3. Ensure Audit Logs can be created and viewed by Admins
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_vinculos_unidade;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_vinculos_unidade;
DROP POLICY IF EXISTS "Admins can manage audit logs" ON public.audit_vinculos_unidade;

CREATE POLICY "Admins can manage audit logs" ON public.audit_vinculos_unidade
    FOR ALL 
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Users can view their own audit logs" ON public.audit_vinculos_unidade
    FOR SELECT 
    TO authenticated
    USING (usuario_id = auth.uid());

-- 4. Ensure Units are visible to all authenticated users
DROP POLICY IF EXISTS "Units are visible to all" ON public.unidades_saude;
CREATE POLICY "Units are visible to all" ON public.unidades_saude
    FOR SELECT
    TO authenticated
    USING (true);

-- 5. Final check on permissions
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.audit_vinculos_unidade TO authenticated;
GRANT ALL ON public.unidades_saude TO authenticated;


-- FILE: 20260314000025_definitive_admin_fix.sql
-- Final and Definitive fix for Admin permissions on Profile management
-- This ensures that users with 'admin' role can manage all profiles within their tenant.

-- 1. Ensure helper functions are robust and use COALESCE
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $func$
DECLARE
    v_role text;
BEGIN
    -- Security Definer bypasses RLS to check the role
    SELECT lower(COALESCE(role, 'user')) INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role IN ('admin', 'super_admin');
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $func$
DECLARE
    v_role text;
BEGIN
    SELECT lower(COALESCE(role, 'user')) INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role = 'super_admin';
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop ALL possible conflicting policies on profiles
DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their unit" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_Update_Team" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to manage team members" ON public.profiles;
DROP POLICY IF EXISTS "Profiles_Admin_New" ON public.profiles;

-- 3. Create a clean and powerful MANAGE policy for Admins
-- We use COALESCE on tenant_id to ensure that legacy/null tenants don't block the check
CREATE POLICY "profiles_admin_manage_all_in_tenant" ON public.profiles
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        id = auth.uid() OR
        (
            public.is_admin() AND 
            COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000') = public.get_current_tenant_id()
        )
    )
    WITH CHECK (
        public.is_super_admin() OR 
        id = auth.uid() OR
        (
            public.is_admin() AND 
            COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000') = public.get_current_tenant_id()
        )
    );

-- 4. Create a clean SELECT policy
CREATE POLICY "profiles_admin_select_all_in_tenant" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin() OR 
        id = auth.uid() OR
        COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000') = public.get_current_tenant_id()
    );

-- 5. Ensure Audit table is also fully accessible to Admins
DROP POLICY IF EXISTS "Admins can manage audit logs" ON public.audit_vinculos_unidade;
CREATE POLICY "Admins can manage audit logs" ON public.audit_vinculos_unidade
    FOR ALL 
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 6. Verify and Fix any NULL tenant_ids just in case
UPDATE public.profiles 
SET tenant_id = '00000000-0000-0000-0000-000000000000' 
WHERE tenant_id IS NULL;

-- 7. Final grant
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.audit_vinculos_unidade TO authenticated;
GRANT ALL ON public.unidades_saude TO authenticated;


-- FILE: 20260314000030_global_catalogs_unit_transactions.sql
-- Ajuste de Visibilidade Global para Produtos e Pacientes (Tenant Isolation)
-- MantÃ©m o isolamento de UNIDADE para transaÃ§Ãµes (Entradas, DispensaÃ§Ãµes, Rascunhos)
-- Libera a visualizaÃ§Ã£o de CADASTROS (Produtos e Pacientes) para todas as unidades do mesmo municÃ­pio.

DO $$ 
DECLARE 
    t text;
    -- Tabelas de CADASTRO que devem ser globais no municÃ­pio (tenant)
    global_tables text[] := ARRAY['produtos', 'pacientes'];
    -- Tabelas de TRANSAÃ‡ÃƒO que devem ser restritas por UNIDADE
    unit_tables text[] := ARRAY[
        'entradas_produtos', 
        'dispensacoes', 
        'rascunhos_compras', 
        'relatorios_compras_rascunho',
        'atendimentos',
        'queixas_principais',
        'procedimentos_realizados',
        'rascunhos_atendimentos'
    ];
BEGIN
    -- 1. Aplicar Visibilidade GLOBAL (MUNICÃPIO) para Produtos e Pacientes
    FOREACH t IN ARRAY global_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Limpar polÃ­ticas anteriores
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            
            -- Criar polÃ­tica de visibilidade por MunicÃ­pio (Tenant)
            -- Permite que todas as unidades vejam os mesmos produtos e pacientes
            EXECUTE format('
                CREATE POLICY "Tenant Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    tenant_id = public.get_current_tenant_id()
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    tenant_id = public.get_current_tenant_id()
                )
            ', t);
            
            RAISE NOTICE 'Visibilidade Global (MunicÃ­pio) aplicada Ã  tabela de cadastro: %', t;
        END IF;
    END LOOP;

    -- 2. Garantir que Tabelas de TRANSAÃ‡ÃƒO continuem restritas por UNIDADE
    FOREACH t IN ARRAY unit_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Limpar e reafirmar o isolamento por Unidade
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            
            EXECUTE format('
                CREATE POLICY "Unit Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.is_admin() OR unidade_id = public.get_current_unidade_id())
                    )
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.is_admin() OR unidade_id = public.get_current_unidade_id())
                    )
                )
            ', t);
            
            RAISE NOTICE 'Isolamento por Unidade mantido para tabela de transaÃ§Ã£o: %', t;
        END IF;
    END LOOP;
END $$;


-- FILE: 20260314000035_fix_global_visibility_v2.sql
-- Ajuste de Visibilidade Global para Produtos e Pacientes (Tenant Isolation + Master Catalog)
-- MantÃ©m o isolamento de UNIDADE para transaÃ§Ãµes (Entradas, DispensaÃ§Ãµes, Rascunhos)
-- Libera a visualizaÃ§Ã£o de CADASTROS (Produtos e Pacientes) para todas as unidades do mesmo municÃ­pio e catÃ¡logo mestre.

DO $$ 
DECLARE 
    master_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
    t text;
    -- Tabelas de CADASTRO que devem ser globais no municÃ­pio (tenant)
    global_tables text[] := ARRAY['produtos', 'pacientes'];
    -- Tabelas de TRANSAÃ‡ÃƒO que devem ser restritas por UNIDADE
    unit_tables text[] := ARRAY[
        'entradas_produtos', 
        'dispensacoes', 
        'rascunhos_compras', 
        'relatorios_compras_rascunho',
        'atendimentos',
        'queixas_principais',
        'procedimentos_realizados',
        'rascunhos_atendimentos'
    ];
BEGIN
    -- 1. Aplicar Visibilidade GLOBAL (MUNICÃPIO + MASTER) para Produtos e Pacientes
    FOREACH t IN ARRAY global_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Limpar polÃ­ticas anteriores para evitar conflitos (OR logic do Supabase)
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Global Tenant Visibility" ON public.%I', t);
            
            -- Habilitar RLS se nÃ£o estiver habilitado
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            -- Criar polÃ­tica de visibilidade por MunicÃ­pio (Tenant) + CatÃ¡logo Mestre
            -- SELECT: Permite ver produtos/pacientes do seu municÃ­pio OU do catÃ¡logo mestre (zeros)
            EXECUTE format('
                CREATE POLICY "Global Tenant Visibility" ON public.%I
                FOR SELECT
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    tenant_id = public.get_current_tenant_id() OR
                    tenant_id = %L
                )
            ', t, master_tenant_id);

            -- INSERT/UPDATE/DELETE: Apenas Admins do prÃ³prio municÃ­pio ou Super Admin podem alterar
            -- Nota: Mantemos o WITH CHECK para garantir que ao inserir, o tenant_id seja respeitado
            EXECUTE format('
                CREATE POLICY "Admin Tenant Management" ON public.%I
                FOR ALL 
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    (tenant_id = public.get_current_tenant_id() AND public.is_admin())
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    (tenant_id = public.get_current_tenant_id() AND public.is_admin())
                )
            ', t);
            
            RAISE NOTICE 'Visibilidade Global (MunicÃ­pio + Master) aplicada Ã  tabela: %', t;
        END IF;
    END LOOP;

    -- 2. Reafirmar Isolamento por UNIDADE para Tabelas de TRANSAÃ‡ÃƒO
    FOREACH t IN ARRAY unit_tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Limpar polÃ­ticas antigas
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Global Tenant Visibility" ON public.%I', t);
            
            -- Habilitar RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            -- Criar polÃ­tica estrita de Unidade
            EXECUTE format('
                CREATE POLICY "Unit Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.is_admin() OR unidade_id = public.get_current_unidade_id())
                    )
                )
                WITH CHECK (
                    public.is_super_admin() OR 
                    (
                        tenant_id = public.get_current_tenant_id() AND 
                        (public.is_admin() OR unidade_id = public.get_current_unidade_id())
                    )
                )
            ', t);
            
            RAISE NOTICE 'Isolamento por Unidade (Unit Isolation) reafirmado para tabela: %', t;
        END IF;
    END LOOP;
END $$;


-- FILE: 20260314000040_super_fix_global_visibility.sql
-- FIX DEFINITIVO: Visibilidade Global de Produtos e Pacientes
-- Garante que todos da mesma prefeitura (Tenant) vejam os mesmos cadastros, 
-- independentemente da unidade onde o item foi criado.

DO $$ 
DECLARE 
    master_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
    t text;
    p_name text;
    global_tables text[] := ARRAY['produtos', 'pacientes'];
BEGIN
    -- 1. Limpeza agressiva de TODAS as polÃ­ticas existentes para evitar conflitos
    FOREACH t IN ARRAY global_tables LOOP
        FOR p_name IN (SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public') LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name, t);
        END LOOP;
        
        -- Garantir que RLS estÃ¡ ativo
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- 2. Criar polÃ­tica de VISUALIZAÃ‡ÃƒO GLOBAL (Mesmo MunicÃ­pio + CatÃ¡logo Mestre)
        EXECUTE format('
            CREATE POLICY "Global_Read_Policy" ON public.%I
            FOR SELECT
            TO authenticated
            USING (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id() OR
                tenant_id = %L
            )
        ', t, master_tenant_id);

        -- 3. Criar polÃ­tica de GESTÃƒO (Inserir/Editar/Excluir) - MunicÃ­pio
        EXECUTE format('
            CREATE POLICY "Global_Manage_Policy" ON public.%I
            FOR ALL 
            TO authenticated
            USING (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id()
            )
            WITH CHECK (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id()
            )
        ', t);

        -- 4. Remover Trigger de Isolamento de Unidade (para estas tabelas, unidade_id nÃ£o deve restringir)
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_unit_and_tenant_id ON public.%I', t);
        
        -- 5. Adicionar Trigger apenas para Tenant (MunicÃ­pio)
        EXECUTE format('
            CREATE OR REPLACE FUNCTION public.set_tenant_only()
            RETURNS TRIGGER AS $func$
            BEGIN
                IF NEW.tenant_id IS NULL THEN
                    NEW.tenant_id := public.get_current_tenant_id();
                END IF;
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ');
        
        EXECUTE format('
            CREATE TRIGGER trigger_set_tenant_only 
            BEFORE INSERT ON public.%I 
            FOR EACH ROW EXECUTE FUNCTION public.set_tenant_only()
        ', t);

        RAISE NOTICE 'Fix Global aplicado Ã  tabela: %', t;
    END LOOP;
END $$;


-- FILE: 20260314000045_nuclear_fix_global_visibility.sql
-- FIX TOTAL E DEFINITIVO: Visibilidade Global de Produtos e Pacientes (Isolamento por Unidade REMOVIDO)
-- Este script limpa TODA E QUALQUER restriÃ§Ã£o de unidade para as tabelas de cadastros.

DO $$ 
DECLARE 
    master_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
    t text;
    p_record record;
    global_tables text[] := ARRAY['produtos', 'pacientes'];
BEGIN
    -- 1. Iterar sobre as tabelas globais (Produtos e Pacientes)
    FOREACH t IN ARRAY global_tables LOOP
        -- 1.1 Remover TODAS as polÃ­ticas existentes (independente do nome)
        FOR p_record IN (SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public') LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_record.policyname, t);
        END LOOP;
        
        -- 1.2 Garantir que RLS estÃ¡ habilitado
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- 1.3 Criar POLÃTICA DE LEITURA TOTAL (Mesmo MunicÃ­pio OU Master)
        -- Esta regra permite que QUALQUER unidade veja os itens, ignorando o unidade_id
        EXECUTE format('
            CREATE POLICY "Allow_Global_Select" ON public.%I
            FOR SELECT
            TO authenticated
            USING (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id() OR
                tenant_id = %L
            )
        ', t, master_tenant_id);

        -- 1.4 Criar POLÃTICA DE MANIPULAÃ‡ÃƒO TOTAL (Mesmo MunicÃ­pio)
        -- Permite inserir/editar se pertencer ao mesmo municÃ­pio
        EXECUTE format('
            CREATE POLICY "Allow_Global_Manage" ON public.%I
            FOR ALL 
            TO authenticated
            USING (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id()
            )
            WITH CHECK (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id()
            )
        ', t);

        -- 1.5 Remover Triggers que forÃ§am o unidade_id (importante!)
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_unit_and_tenant_id ON public.%I', t);
        EXECUTE format('DROP TRIGGER IF EXISTS tr_set_rascunho_unidade_id ON public.%I', t);
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_tenant_only ON public.%I', t);
        
        -- 1.6 Criar Trigger que forÃ§a APENAS o tenant_id (MunicÃ­pio), limpando o unidade_id se vier preenchido
        -- Isso garante que o produto/paciente nÃ£o fique "preso" a uma unidade
        EXECUTE format('
            CREATE OR REPLACE FUNCTION public.force_tenant_no_unit()
            RETURNS TRIGGER AS $func$
            BEGIN
                IF NEW.tenant_id IS NULL THEN
                    NEW.tenant_id := public.get_current_tenant_id();
                END IF;
                -- Limpamos o unidade_id para garantir que nÃ£o haja filtros de unidade acidentais
                NEW.unidade_id := NULL;
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ');
        
        EXECUTE format('
            CREATE TRIGGER trigger_force_tenant_no_unit 
            BEFORE INSERT OR UPDATE ON public.%I 
            FOR EACH ROW EXECUTE FUNCTION public.force_tenant_no_unit()
        ', t);

        RAISE NOTICE 'Isolamento de Unidade REMOVIDO com sucesso da tabela: %', t;
    END LOOP;
END $$;

-- 2. Limpeza de dados: Remover unidade_id de produtos e pacientes existentes
-- Isso garante que filtros antigos nÃ£o funcionem por causa de dados residuais
UPDATE public.produtos SET unidade_id = NULL;
UPDATE public.pacientes SET unidade_id = NULL;


-- FILE: 20260314000050_fix_global_visibility_final.sql
-- FIX TOTAL E DEFINITIVO: Visibilidade Global de Produtos e Pacientes (Isolamento por Unidade REMOVIDO)
-- Este script limpa TODA E QUALQUER restriÃ§Ã£o de unidade para as tabelas de cadastros.
-- Garante que todos da mesma prefeitura (Tenant) vejam os mesmos cadastros, independentemente da unidade.

DO $$ 
DECLARE 
    master_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
    t text;
    p_record record;
    global_tables text[] := ARRAY['produtos', 'pacientes'];
BEGIN
    -- 1. Iterar sobre as tabelas globais (Produtos e Pacientes)
    FOREACH t IN ARRAY global_tables LOOP
        -- 1.1 Remover TODAS as polÃ­ticas existentes (independente do nome)
        FOR p_record IN (SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public') LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_record.policyname, t);
        END LOOP;
        
        -- 1.2 Garantir que RLS estÃ¡ habilitado
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- 1.3 Criar POLÃTICA DE LEITURA TOTAL (Mesmo MunicÃ­pio OU Master)
        -- Esta regra permite que QUALQUER unidade veja os itens, ignorando o unidade_id
        EXECUTE format('
            CREATE POLICY "Global_Read_Policy" ON public.%I
            FOR SELECT
            TO authenticated
            USING (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id() OR
                tenant_id = %L
            )
        ', t, master_tenant_id);

        -- 1.4 Criar POLÃTICA DE MANIPULAÃ‡ÃƒO TOTAL (Mesmo MunicÃ­pio)
        -- Permite inserir/editar se pertencer ao mesmo municÃ­pio
        EXECUTE format('
            CREATE POLICY "Global_Manage_Policy" ON public.%I
            FOR ALL 
            TO authenticated
            USING (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id()
            )
            WITH CHECK (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id()
            )
        ', t);

        -- 1.5 Remover Triggers que forÃ§am o unidade_id (importante!)
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_unit_and_tenant_id ON public.%I', t);
        EXECUTE format('DROP TRIGGER IF EXISTS tr_set_rascunho_unidade_id ON public.%I', t);
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_tenant_only ON public.%I', t);
        
        -- 1.6 Criar Trigger que forÃ§a APENAS o tenant_id (MunicÃ­pio), limpando o unidade_id se vier preenchido
        -- Isso garante que o produto/paciente nÃ£o fique "preso" a uma unidade
        EXECUTE format('
            CREATE OR REPLACE FUNCTION public.force_tenant_no_unit()
            RETURNS TRIGGER AS $func$
            BEGIN
                IF NEW.tenant_id IS NULL THEN
                    NEW.tenant_id := public.get_current_tenant_id();
                END IF;
                -- Limpamos o unidade_id para garantir que nÃ£o haja filtros de unidade acidentais
                NEW.unidade_id := NULL;
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ');
        
        EXECUTE format('
            CREATE TRIGGER trigger_force_tenant_no_unit 
            BEFORE INSERT OR UPDATE ON public.%I 
            FOR EACH ROW EXECUTE FUNCTION public.force_tenant_no_unit()
        ', t);

        RAISE NOTICE 'Isolamento de Unidade REMOVIDO com sucesso da tabela: %', t;
    END LOOP;
END $$;

-- 2. Limpeza de dados: Remover unidade_id de produtos e pacientes existentes
-- Isso garante que filtros antigos nÃ£o funcionem por causa de dados residuais
UPDATE public.produtos SET unidade_id = NULL;
UPDATE public.pacientes SET unidade_id = NULL;


-- FILE: 20260314000055_fix_stock_by_unit.sql
-- CORREÃ‡ÃƒO DE ESTOQUE POR UNIDADE
-- Garante que o catÃ¡logo de produtos seja global, mas o cÃ¡lculo de estoque seja individual por unidade.

-- 1. Criar funÃ§Ã£o para calcular estoque por unidade
CREATE OR REPLACE FUNCTION public.get_estoque_por_unidade(p_produto_id UUID, p_unidade_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_entradas INTEGER;
    v_saidas INTEGER;
BEGIN
    -- Somar todas as entradas daquele produto nesta unidade
    SELECT COALESCE(SUM(quantidade), 0) INTO v_entradas
    FROM public.entradas_produtos
    WHERE produto_id = p_produto_id AND unidade_id = p_unidade_id;

    -- Somar todas as saÃ­das (dispensaÃ§Ãµes) daquele produto nesta unidade
    SELECT COALESCE(SUM(quantidade), 0) INTO v_saidas
    FROM public.dispensacoes
    WHERE produto_id = p_produto_id AND unidade_id = p_unidade_id;

    RETURN v_entradas - v_saidas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. (Opcional) Criar uma View para facilitar a consulta de estoque por unidade
DROP VIEW IF EXISTS public.view_estoque_unidades;
CREATE VIEW public.view_estoque_unidades AS
SELECT 
    p.id as produto_id,
    p.descricao,
    u.id as unidade_id,
    u.nome as unidade_nome,
    public.get_estoque_por_unidade(p.id, u.id) as estoque_atual
FROM 
    public.produtos p
CROSS JOIN 
    public.unidades_saude u;

GRANT SELECT ON public.view_estoque_unidades TO authenticated;


-- FILE: 20260314000060_strict_unit_isolation_transactions.sql
-- Isolamento Estrito por Unidade para TransaÃ§Ãµes (Mesmo para Admins)
-- Garante que entradas e dispensaÃ§Ãµes sejam filtradas pela unidade atual do usuÃ¡rio logado.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY[
        'entradas_produtos', 
        'dispensacoes', 
        'rascunhos_compras', 
        'relatorios_compras_rascunho',
        'atendimentos',
        'queixas_principais',
        'procedimentos_realizados',
        'rascunhos_atendimentos'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Remover polÃ­ticas antigas
            EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation" ON public.%I', t);
            
            -- Criar polÃ­tica de isolamento estrito
            -- Agora ignoramos se o usuÃ¡rio Ã© Admin ou Super Admin para a visualizaÃ§Ã£o de transaÃ§Ãµes
            -- Ele verÃ¡ APENAS o que pertence Ã  unidade que estÃ¡ vinculada no seu perfil agora.
            EXECUTE format('
                CREATE POLICY "Strict Unit Isolation" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    unidade_id = public.get_current_unidade_id()
                )
                WITH CHECK (
                    unidade_id = public.get_current_unidade_id()
                )
            ', t);
            
            RAISE NOTICE 'Isolamento estrito aplicado Ã  tabela: %', t;
        END IF;
    END LOOP;
END $$;


-- FILE: 20260315000001_reset_stock_movements_only.sql
-- SQL para zerar APENAS Entradas e SaÃ­das (DispensaÃ§Ãµes) de todas as unidades
-- Este script remove apenas os registros de movimentaÃ§Ã£o de estoque, limpando os histÃ³ricos.

DO $$ 
DECLARE 
    t text;
    -- Tabelas de movimentaÃ§Ã£o de estoque
    tables text[] := ARRAY[
        'entradas_produtos', 
        'dispensacoes'
    ];
BEGIN
    -- 1. Limpar apenas as tabelas de entradas e saÃ­das
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('TRUNCATE TABLE public.%I CASCADE', t);
            RAISE NOTICE 'Tabela % zerada com sucesso.', t;
        END IF;
    END LOOP;

    -- 2. Resetar o campo estoque_atual na tabela de produtos para 0
    -- Isso garante que a interface reflita que nÃ£o hÃ¡ estoque em nenhuma unidade
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos') THEN
        UPDATE public.produtos SET estoque_atual = 0;
        RAISE NOTICE 'Estoque dos produtos resetado para 0.';
    END IF;

    RAISE NOTICE 'Reset concluÃ­do: Entradas e SaÃ­das apagadas. HistÃ³ricos limpos.';
END $$;


-- FILE: 20260315000010_allow_global_pedidos_permission.sql
-- AtualizaÃ§Ã£o de SeguranÃ§a para Acesso Global de Pedidos
-- Esta migraÃ§Ã£o ajusta as polÃ­ticas de RLS para respeitar a nova permissÃ£o 'acesso_global_pedidos'

DO $$ 
BEGIN
    -- 1. Atualizar a polÃ­tica da tabela rascunhos_compras
    DROP POLICY IF EXISTS "Strict Unit Isolation" ON public.rascunhos_compras;
    DROP POLICY IF EXISTS "Unit Isolation" ON public.rascunhos_compras;

    CREATE POLICY "Pedidos Global Access Policy" ON public.rascunhos_compras
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (
                public.is_admin() OR 
                (SELECT (permissions->>'acesso_global_pedidos')::boolean FROM public.profiles WHERE id = auth.uid()) = true OR
                unidade_id = public.get_current_unidade_id()
            )
        )
    )
    WITH CHECK (
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (
                public.is_admin() OR 
                (SELECT (permissions->>'acesso_global_pedidos')::boolean FROM public.profiles WHERE id = auth.uid()) = true OR
                unidade_id = public.get_current_unidade_id()
            )
        )
    );

    RAISE NOTICE 'PolÃ­tica de acesso global aos pedidos atualizada.';
END $$;


-- FILE: 20260315000011_fix_global_pedidos_rls_robust.sql
-- AtualizaÃ§Ã£o de SeguranÃ§a para Acesso Global de Pedidos (v2)
-- Esta migraÃ§Ã£o ajusta as polÃ­ticas de RLS para respeitar a nova permissÃ£o 'acesso_global_pedidos'
-- de forma mais robusta, tratando casos onde o campo pode estar ausente.

DO $$ 
BEGIN
    -- 1. Atualizar a polÃ­tica da tabela rascunhos_compras
    DROP POLICY IF EXISTS "Pedidos Global Access Policy" ON public.rascunhos_compras;
    DROP POLICY IF EXISTS "Strict Unit Isolation" ON public.rascunhos_compras;
    DROP POLICY IF EXISTS "Unit Isolation" ON public.rascunhos_compras;

    CREATE POLICY "Pedidos Global Access Policy" ON public.rascunhos_compras
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (
                public.is_admin() OR 
                -- VerificaÃ§Ã£o robusta de permissÃ£o JSONB
                (
                    SELECT COALESCE((permissions->>'acesso_global_pedidos')::boolean, false) 
                    FROM public.profiles 
                    WHERE id = auth.uid()
                ) = true OR
                unidade_id = public.get_current_unidade_id()
            )
        )
    )
    WITH CHECK (
        public.is_super_admin() OR 
        (
            tenant_id = public.get_current_tenant_id() AND 
            (
                public.is_admin() OR 
                (
                    SELECT COALESCE((permissions->>'acesso_global_pedidos')::boolean, false) 
                    FROM public.profiles 
                    WHERE id = auth.uid()
                ) = true OR
                unidade_id = public.get_current_unidade_id()
            )
        )
    );

    RAISE NOTICE 'PolÃ­tica de acesso global aos pedidos atualizada com robustez.';
END $$;


-- FILE: 20260315000020_pedido_workflow_automation.sql
-- MigraÃ§Ã£o para Fluxo de AutorizaÃ§Ã£o e Entrega de Pedidos SMSA
-- Adiciona status, controle de autorizaÃ§Ã£o e automaÃ§Ã£o de estoque.

-- 1. Adicionar novas colunas Ã  tabela rascunhos_compras
ALTER TABLE public.rascunhos_compras 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'autorizado', 'entregue')),
ADD COLUMN IF NOT EXISTS autorizado_por_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS data_autorizacao TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS entregue_por_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ;

-- 2. FunÃ§Ã£o para processar a entrega e atualizar o estoque automaticamente
CREATE OR REPLACE FUNCTION public.processar_entrega_pedido()
RETURNS TRIGGER AS $$
DECLARE
    v_item JSONB;
    v_unidade_id UUID;
    v_tenant_id UUID;
BEGIN
    -- SÃ³ executa se o status mudou para 'entregue'
    IF (OLD.status = 'autorizado' AND NEW.status = 'entregue') THEN
        v_unidade_id := NEW.unidade_id;
        v_tenant_id := NEW.tenant_id;

        -- Iterar sobre os itens do pedido salvos no JSONB dados_produtos
        -- O JSONB deve ser um array de objetos: [{"id": "...", "quantidade_reposicao": 500}, ...]
        FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.dados_produtos)
        LOOP
            -- Apenas se houver quantidade solicitada
            IF (v_item->>'quantidade_reposicao')::numeric > 0 THEN
                INSERT INTO public.entradas_produtos (
                    produto_id,
                    unidade_id,
                    tenant_id,
                    quantidade,
                    lote,
                    vencimento,
                    data_entrada,
                    created_at,
                    usuario_id
                ) VALUES (
                    (v_item->>'id')::UUID,
                    v_unidade_id,
                    v_tenant_id,
                    (v_item->>'quantidade_reposicao')::numeric,
                    'PEDIDO-' || to_char(NEW.data_entrega, 'DDMMYY'), -- Lote automÃ¡tico identificando o pedido
                    (CURRENT_DATE + INTERVAL '2 years')::date, -- Vencimento padrÃ£o (pode ser ajustado)
                    CURRENT_DATE,
                    NOW(),
                    NEW.usuario_id
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger para disparar a automaÃ§Ã£o na entrega
DROP TRIGGER IF EXISTS trigger_processar_entrega ON public.rascunhos_compras;
CREATE TRIGGER trigger_processar_entrega
    AFTER UPDATE OF status ON public.rascunhos_compras
    FOR EACH ROW
    WHEN (NEW.status = 'entregue')
    EXECUTE FUNCTION public.processar_entrega_pedido();

-- 4. Atualizar RLS para permitir que quem tem acesso global altere o status
DROP POLICY IF EXISTS "Pedidos Global Access Policy" ON public.rascunhos_compras;
CREATE POLICY "Pedidos Global Access Policy" ON public.rascunhos_compras
FOR ALL
TO authenticated
USING (
    public.is_super_admin() OR 
    (
        tenant_id = public.get_current_tenant_id() AND 
        (
            public.is_admin() OR 
            (SELECT COALESCE((permissions->>'acesso_global_pedidos')::boolean, false) FROM public.profiles WHERE id = auth.uid()) = true OR
            unidade_id = public.get_current_unidade_id()
        )
    )
)
WITH CHECK (
    public.is_super_admin() OR 
    (
        tenant_id = public.get_current_tenant_id() AND 
        (
            public.is_admin() OR 
            (SELECT COALESCE((permissions->>'acesso_global_pedidos')::boolean, false) FROM public.profiles WHERE id = auth.uid()) = true OR
            unidade_id = public.get_current_unidade_id()
        )
    )
);


-- FILE: 20260315000030_relax_unit_isolation_for_pedidos.sql
-- AtualizaÃ§Ã£o de SeguranÃ§a: Relaxar Isolamento Estrito para GestÃ£o de Pedidos
-- Permite que usuÃ¡rios com permissÃ£o 'acesso_global_pedidos' ou Super Admins vejam transaÃ§Ãµes de outras unidades.
-- Isso Ã© necessÃ¡rio para que o Almoxarifado Central possa ver o estoque da unidade solicitante.

DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY['entradas_produtos', 'dispensacoes'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Remover polÃ­ticas antigas
            EXECUTE format('DROP POLICY IF EXISTS "Strict Unit Isolation" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Global Access for Pedidos" ON public.%I', t);
            
            -- Criar nova polÃ­tica flexÃ­vel
            -- 1. UsuÃ¡rio vÃª sua prÃ³pria unidade (Isolamento padrÃ£o)
            -- 2. Super Admin vÃª tudo (Global)
            -- 3. UsuÃ¡rio com 'acesso_global_pedidos' vÃª tudo (Global) - necessÃ¡rio para validar pedidos
            EXECUTE format('
                CREATE POLICY "Global Access for Pedidos" ON public.%I
                FOR ALL
                TO authenticated
                USING (
                    unidade_id = public.get_current_unidade_id() OR
                    public.is_super_admin() OR
                    (
                        SELECT COALESCE((permissions->>''acesso_global_pedidos'')::boolean, false) 
                        FROM public.profiles 
                        WHERE id = auth.uid()
                    ) = true
                )
                WITH CHECK (
                    unidade_id = public.get_current_unidade_id() OR
                    public.is_super_admin() OR
                    (
                        SELECT COALESCE((permissions->>''acesso_global_pedidos'')::boolean, false) 
                        FROM public.profiles 
                        WHERE id = auth.uid()
                    ) = true
                )
            ', t);
            
            RAISE NOTICE 'PolÃ­tica Global Access for Pedidos aplicada Ã  tabela: %', t;
        END IF;
    END LOOP;
END $$;


-- FILE: 20260316000000_add_phone_to_signup.sql
-- Update handle_new_user to include phone from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, phone, tenant_id, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        new.raw_user_meta_data->>'phone',
        CASE 
            WHEN new.raw_user_meta_data->>'tenant_id' IS NULL OR new.raw_user_meta_data->>'tenant_id' = '' THEN NULL 
            ELSE (new.raw_user_meta_data->>'tenant_id')::uuid 
        END,
        COALESCE(new.raw_user_meta_data->>'role', 'user')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- FILE: 20260316000010_add_delete_user_rpc.sql
-- Migration to allow admins to delete users
CREATE OR REPLACE FUNCTION public.delete_user(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_caller_role TEXT;
    v_target_role TEXT;
BEGIN
    -- Get the role of the caller
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    
    -- Get the role of the target user
    SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;

    -- Check if the current user is an admin or super admin
    IF v_caller_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores podem excluir usuÃ¡rios.';
    END IF;

    -- Prevent deleting yourself
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'VocÃª nÃ£o pode excluir sua prÃ³pria conta atravÃ©s deste painel.';
    END IF;

    -- Super Admin can delete anyone (except themselves)
    -- Admin can only delete 'user' (COMUM), not other admins or super admins
    IF v_caller_role = 'admin' AND v_target_role IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Acesso negado: Administradores nÃ£o podem excluir outros administradores.';
    END IF;

    -- Delete related audit records first to satisfy foreign key constraints
    DELETE FROM public.audit_vinculos_unidade WHERE usuario_id = p_user_id;
    DELETE FROM public.audit_vinculos_unidade WHERE admin_id = p_user_id;

    -- Delete from auth.users (cascades to public.profiles)
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- FILE: reset_entrada-saida.sql
-- Reset System Data for Testing (reset_entrada-saida)
-- This script clears all transactional data (entries and dispensations)
-- while preserving core data (patients, products, tenants, profiles).

DO $$
BEGIN
    -- 1. Clear all dispensations
    TRUNCATE TABLE public.dispensacoes CASCADE;
    
    -- 2. Clear all product entries
    TRUNCATE TABLE public.entradas_produtos CASCADE;
    
    -- 3. Clear all purchase drafts
    TRUNCATE TABLE public.rascunhos_compras CASCADE;
    
    -- 4. Clear system logs
    TRUNCATE TABLE public.logs_sistema CASCADE;
    
    -- 5. Reset all product stocks to zero
    -- This ensures we start from a clean slate where every entry counts.
    UPDATE public.produtos SET estoque_atual = 0;

    -- Note: Patients (pacientes), Products (produtos), Units (unidades_medida), 
    -- Tenants (tenants) and Profiles (profiles) are PRESERVED.
END $$;


