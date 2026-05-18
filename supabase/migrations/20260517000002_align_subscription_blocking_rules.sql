-- Regra final de bloqueio da assinatura:
-- 1. force_active  => nunca bloqueia
-- 2. force_blocked => sempre bloqueia
-- 3. canceled      => bloqueia
-- 4. pending       => bloqueia por inadimplencia
-- 5. waiting/paid  => mantem acesso ativo

CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_override TEXT;
    v_subscription_status TEXT;
BEGIN
    IF p_tenant_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT subscription_access_override
    INTO v_override
    FROM public.tenants
    WHERE id = p_tenant_id;

    IF v_override = 'force_active' THEN
        RETURN FALSE;
    END IF;

    IF v_override = 'force_blocked' THEN
        RETURN TRUE;
    END IF;

    PERFORM public.sync_invoice_status(p_tenant_id);

    SELECT sub.status
    INTO v_subscription_status
    FROM public.subscriptions sub
    WHERE sub.tenant_id = p_tenant_id
    ORDER BY sub.created_at DESC
    LIMIT 1;

    IF v_subscription_status = 'canceled' THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.subscription_invoices
        WHERE tenant_id = p_tenant_id
          AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
