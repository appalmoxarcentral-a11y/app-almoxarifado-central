
-- Criar enum para unidades de medida
CREATE TYPE unidade_medida AS ENUM ('AM', 'CP', 'BG', 'FR', 'CPS', 'ML', 'MG', 'G', 'KG', 'UN');

-- Criar enum para tipos de usuário
CREATE TYPE tipo_usuario AS ENUM ('ADMIN', 'COMUM');

-- Tabela de usuários (sistema customizado sem auth do Supabase)
CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL, -- será armazenado como hash
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

-- Tabela de pacientes (idade será calculada na aplicação)
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

-- Tabela de dispensações
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

-- Criar índices para otimização
CREATE INDEX idx_pacientes_sus_cpf ON public.pacientes(sus_cpf);
CREATE INDEX idx_produtos_codigo ON public.produtos(codigo);
CREATE INDEX idx_entradas_produto_id ON public.entradas_produtos(produto_id);
CREATE INDEX idx_entradas_data ON public.entradas_produtos(data_entrada);
CREATE INDEX idx_dispensacoes_paciente_id ON public.dispensacoes(paciente_id);
CREATE INDEX idx_dispensacoes_produto_id ON public.dispensacoes(produto_id);
CREATE INDEX idx_dispensacoes_data ON public.dispensacoes(data_dispensa);
CREATE INDEX idx_logs_usuario_id ON public.logs_sistema(usuario_id);
CREATE INDEX idx_logs_data ON public.logs_sistema(created_at);

-- Função para atualizar estoque automaticamente nas entradas
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

-- Função para atualizar estoque automaticamente nas dispensações
CREATE OR REPLACE FUNCTION atualizar_estoque_dispensacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se há estoque suficiente
  IF (SELECT estoque_atual FROM public.produtos WHERE id = NEW.produto_id) < NEW.quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente para dispensação';
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

-- Função para hash de senhas (simples para demonstração)
CREATE OR REPLACE FUNCTION hash_senha(senha_texto TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(senha_texto, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Inserir usuário administrador padrão
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
('Soro Fisiológico 0,9%', 'SFO09', 'FR', 50),
('Insulina NPH', 'INS001', 'FR', 25);

-- Inserir pacientes com idade calculada manualmente
INSERT INTO public.pacientes (nome, sus_cpf, endereco, bairro, telefone, nascimento, idade) VALUES
('João Silva Santos', '123.456.789-00', 'Rua das Flores, 123', 'Centro', '(11) 99999-1234', '1980-05-15', 44),
('Maria Oliveira Costa', '987.654.321-00', 'Av. Principal, 456', 'Jardim América', '(11) 88888-5678', '1975-12-20', 49),
('José Carlos Pereira', '456.789.123-00', 'Rua da Paz, 789', 'Vila Nova', '(11) 77777-9012', '1990-03-10', 34);
