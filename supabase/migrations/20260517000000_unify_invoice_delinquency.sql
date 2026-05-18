-- Unifica a regra de inadimplencia em uma unica fonte de verdade no banco.
-- waiting  : invoice em aberto dentro da janela de graca
-- pending  : invoice em aberto com mais de 10 dias de atraso
-- paid     : invoice quitada

CREATE OR REPLACE FUNCTION public.sync_invoice_status(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    IF p_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- waiting -> pending quando a fatura esta vencida ha mais de 10 dias
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id
      AND status = 'waiting'
      AND due_date IS NOT NULL
      AND due_date < (now() - INTERVAL '10 days');

    -- pending -> waiting quando a fatura ainda esta dentro da janela de graca
    UPDATE public.subscription_invoices
    SET status = 'waiting'
    WHERE tenant_id = p_tenant_id
      AND status = 'pending'
      AND due_date IS NOT NULL
      AND due_date >= (now() - INTERVAL '10 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    PERFORM public.sync_invoice_status(p_tenant_id);

    RETURN EXISTS (
        SELECT 1
        FROM public.subscription_invoices
        WHERE tenant_id = p_tenant_id
          AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
