
-- 1. Create table procedimentos if it doesn't exist
CREATE TABLE IF NOT EXISTS public.procedimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Add unique constraint to procedures name per tenant
DELETE FROM public.procedimentos a
USING public.procedimentos b
WHERE a.id < b.id
  AND a.nome = b.nome
  AND a.tenant_id = b.tenant_id;

ALTER TABLE public.procedimentos DROP CONSTRAINT IF EXISTS procedimentos_nome_tenant_key;
ALTER TABLE public.procedimentos ADD CONSTRAINT procedimentos_nome_tenant_key UNIQUE (nome, tenant_id);

-- 3. Add columns to dispensacoes table
ALTER TABLE public.dispensacoes ADD COLUMN IF NOT EXISTS procedimento TEXT;
ALTER TABLE public.dispensacoes ADD COLUMN IF NOT EXISTS is_parcial BOOLEAN DEFAULT false;

-- 4. Update the stock deduction function to respect is_parcial
CREATE OR REPLACE FUNCTION public.atualizar_estoque_dispensacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
    v_estoque_atual integer;
BEGIN
    -- Only deduct stock if it's NOT a partial dispensation
    -- NEW.is_parcial can be NULL, so we handle it as FALSE (total)
    IF (TG_OP = 'INSERT') AND (COALESCE(NEW.is_parcial, false) = false) THEN
        SELECT estoque_atual INTO v_estoque_atual FROM public.produtos WHERE id = NEW.produto_id;

        IF v_estoque_atual IS NULL OR v_estoque_atual < NEW.quantidade THEN
            RAISE EXCEPTION 'Estoque insuficiente para dispensação (Disponível: %, Solicitado: %)', 
                COALESCE(v_estoque_atual, 0), NEW.quantidade;
        END IF;
        
        UPDATE public.produtos SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.produto_id;
        
        INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
        VALUES (NEW.usuario_id, 'DISPENSACAO', 'dispensacoes', 
                json_build_object('paciente_id', NEW.paciente_id, 'produto_id', NEW.produto_id, 'quantidade', NEW.quantidade, 'lote', NEW.lote, 'is_parcial', NEW.is_parcial),
                COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
    ELSIF (TG_OP = 'INSERT') AND (COALESCE(NEW.is_parcial, false) = true) THEN
        -- Still log the partial dispensation
        INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
        VALUES (NEW.usuario_id, 'DISPENSACAO_PARCIAL', 'dispensacoes', 
                json_build_object('paciente_id', NEW.paciente_id, 'produto_id', NEW.produto_id, 'quantidade', NEW.quantidade, 'lote', NEW.lote, 'is_parcial', true),
                COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
    END IF;
    
    RETURN NEW;
END;
$$;

-- 5. Ensure trigger exists and points to the updated function
DROP TRIGGER IF EXISTS trigger_dispensacao_unica ON public.dispensacoes;
CREATE TRIGGER trigger_dispensacao_unica
    AFTER INSERT ON public.dispensacoes
    FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_dispensacao();

-- 6. Enable RLS for procedimentos
ALTER TABLE public.procedimentos ENABLE ROW LEVEL SECURITY;

-- 7. Add RLS policy for procedimentos
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.procedimentos;
    CREATE POLICY "Tenant Isolation" ON public.procedimentos FOR ALL TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());
END $$;
