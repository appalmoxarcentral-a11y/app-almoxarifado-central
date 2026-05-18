-- Separa o override manual de acesso do status financeiro das faturas.
-- pending / waiting / paid continuam livres para fluxo real de cobranca e testes.

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS subscription_access_override TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tenants_subscription_access_override_check'
    ) THEN
        ALTER TABLE public.tenants
        ADD CONSTRAINT tenants_subscription_access_override_check
        CHECK (
            subscription_access_override IS NULL
            OR subscription_access_override IN ('force_active', 'force_blocked')
        );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_tenant_subscription_access_override(
    p_tenant_id UUID,
    p_override TEXT
)
RETURNS VOID AS $$
BEGIN
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Apenas super admins podem alterar o override da assinatura';
    END IF;

    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant invalido';
    END IF;

    IF p_override IS NOT NULL AND p_override NOT IN ('force_active', 'force_blocked') THEN
        RAISE EXCEPTION 'Override invalido. Use force_active, force_blocked ou null';
    END IF;

    UPDATE public.tenants
    SET subscription_access_override = p_override
    WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_invoice_status(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    IF p_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Mantem pending definido manualmente ou por integracao externa.
    -- So promove waiting -> pending quando a invoice venceu ha mais de 10 dias.
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id
      AND status = 'waiting'
      AND due_date IS NOT NULL
      AND due_date < (now() - INTERVAL '10 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_override TEXT;
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

    RETURN EXISTS (
        SELECT 1
        FROM public.subscription_invoices
        WHERE tenant_id = p_tenant_id
          AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
