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
        RAISE EXCEPTION 'Estoque insuficiente para dispensação (Disponível: %, Solicitado: %)', 
            COALESCE(v_estoque_atual, 0), NEW.quantidade;
    END IF;
    
    -- 3. Subtrair do estoque na tabela 'produtos'
    UPDATE public.produtos 
    SET estoque_atual = estoque_atual - NEW.quantidade 
    WHERE id = NEW.produto_id;
    
    -- 4. Registrar log da operação
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
