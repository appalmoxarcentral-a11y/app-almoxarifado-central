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
    -- Atualiza o estoque na tabela padrão 'produtos'
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
    -- Verificar se há estoque suficiente na tabela padrão 'produtos'
    SELECT estoque_atual INTO v_estoque_atual FROM public.produtos WHERE id = NEW.produto_id;

    IF v_estoque_atual IS NULL OR v_estoque_atual < NEW.quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para dispensação';
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
