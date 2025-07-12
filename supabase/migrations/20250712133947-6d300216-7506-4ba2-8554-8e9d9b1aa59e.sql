-- 1. Primeiro, sincronizar dados existentes para garantir que todas as unidades do enum estejam na tabela
INSERT INTO unidades_medida (codigo, descricao, ativo) 
VALUES 
  ('AM', 'Ampola', true),
  ('CP', 'Comprimido', true),
  ('BG', 'Bisnaga', true),
  ('FR', 'Frasco', true),
  ('CPS', 'Cápsula', true),
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

-- 4. Adicionar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_produtos_unidade_medida ON produtos(unidade_medida);

-- 5. Verificar se existem produtos com unidades inválidas
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM produtos p 
    LEFT JOIN unidades_medida um ON p.unidade_medida = um.codigo 
    WHERE um.codigo IS NULL;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE 'Encontrados % produtos com unidades inválidas', invalid_count;
    ELSE
        RAISE NOTICE 'Todos os produtos têm unidades válidas';
    END IF;
END $$;