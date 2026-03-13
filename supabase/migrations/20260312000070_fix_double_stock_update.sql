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
            RAISE EXCEPTION 'Estoque insuficiente para dispensação (Disponível: %, Solicitado: %)', 
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
