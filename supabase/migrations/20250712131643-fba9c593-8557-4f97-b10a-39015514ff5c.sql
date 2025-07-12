-- Adicionar TST ao enum para resolver inconsistência atual
ALTER TYPE unidade_medida ADD VALUE 'TST';

-- Função para sincronizar automaticamente enum com novas unidades de medida
CREATE OR REPLACE FUNCTION sincronizar_enum_unidade_medida()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o valor já existe no enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'unidade_medida')
    AND enumlabel = NEW.codigo
  ) THEN
    -- Adicionar ao enum se não existir
    EXECUTE format('ALTER TYPE unidade_medida ADD VALUE %L', NEW.codigo);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronização automática após inserção de nova unidade
CREATE TRIGGER trigger_sincronizar_enum_unidade_medida
  AFTER INSERT ON unidades_medida
  FOR EACH ROW
  EXECUTE FUNCTION sincronizar_enum_unidade_medida();