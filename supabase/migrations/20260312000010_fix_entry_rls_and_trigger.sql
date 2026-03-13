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

    -- Verificar se há estoque suficiente
    EXECUTE format('SELECT estoque_atual FROM public.%I WHERE id = $1', v_table_name)
    INTO v_estoque_atual
    USING NEW.produto_id;

    IF v_estoque_atual IS NULL OR v_estoque_atual < NEW.quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente para dispensação';
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


