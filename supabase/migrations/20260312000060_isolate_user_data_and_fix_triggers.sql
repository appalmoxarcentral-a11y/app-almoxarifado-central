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
        -- Ajusta a diferença
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
