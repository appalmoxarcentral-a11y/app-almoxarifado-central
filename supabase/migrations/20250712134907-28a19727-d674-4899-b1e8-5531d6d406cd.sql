-- Remover o enum antigo que está causando problemas
DROP TYPE IF EXISTS unidade_medida CASCADE;

-- Verificar e limpar qualquer unidade inválida que possa estar causando problemas
-- Primeiro, verificar se existem produtos com unidades que não existem na tabela
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

-- Garantir que a foreign key está funcionando corretamente
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS fk_produtos_unidade_medida;
ALTER TABLE produtos ADD CONSTRAINT fk_produtos_unidade_medida 
  FOREIGN KEY (unidade_medida) 
  REFERENCES unidades_medida(codigo);