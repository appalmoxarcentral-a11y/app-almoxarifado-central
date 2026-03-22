
-- Migration: Add is_servidor to dispensacoes and update trigger
ALTER TABLE public.dispensacoes ADD COLUMN IF NOT EXISTS is_servidor BOOLEAN DEFAULT false;

-- Update the stock deduction function to include is_servidor in logs
CREATE OR REPLACE FUNCTION public.atualizar_estoque_dispensacao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_estoque_atual integer;
BEGIN
    -- Só deduz do estoque se NÃO for uma dispensação parcial
    IF (TG_OP = 'INSERT') AND (COALESCE(NEW.is_parcial, false) = false) THEN
        -- Busca estoque na unidade específica
        SELECT estoque_atual INTO v_estoque_atual 
        FROM public.produtos_estoque 
        WHERE produto_id = NEW.produto_id AND unidade_id = NEW.unidade_id;

        IF v_estoque_atual IS NULL OR v_estoque_atual < NEW.quantidade THEN
            RAISE EXCEPTION 'Estoque insuficiente na unidade para dispensação (Disponível: %, Solicitado: %)', 
                COALESCE(v_estoque_atual, 0), NEW.quantidade;
        END IF;
        
        UPDATE public.produtos_estoque 
        SET estoque_atual = estoque_atual - NEW.quantidade, updated_at = NOW()
        WHERE produto_id = NEW.produto_id AND unidade_id = NEW.unidade_id;
        
        INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
        VALUES (NEW.usuario_id, 'DISPENSACAO', 'dispensacoes', 
                json_build_object('paciente_id', NEW.paciente_id, 'produto_id', NEW.produto_id, 'quantidade', NEW.quantidade, 'lote', NEW.lote, 'is_parcial', false, 'is_servidor', NEW.is_servidor),
                COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
    
    ELSIF (TG_OP = 'INSERT') AND (COALESCE(NEW.is_parcial, false) = true) THEN
        INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes, tenant_id)
        VALUES (NEW.usuario_id, 'DISPENSACAO_PARCIAL', 'dispensacoes', 
                json_build_object('paciente_id', NEW.paciente_id, 'produto_id', NEW.produto_id, 'quantidade', NEW.quantidade, 'lote', NEW.lote, 'is_parcial', true, 'is_servidor', NEW.is_servidor),
                COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000000'));
    END IF;
    
    RETURN NEW;
END;
$function$;
