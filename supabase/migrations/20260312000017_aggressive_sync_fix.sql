
-- Aggressive sync: Update ALL unpaid invoices to the current plan price of the tenant.
-- This handles the case where subscription_id might be null or outdated.
CREATE OR REPLACE FUNCTION public.sync_all_unpaid_invoices()
RETURNS void AS $$
DECLARE
    v_updated_count INT;
BEGIN
    RAISE NOTICE 'Aggressive Manual Sync Invoices started.';

    -- 1. First attempt: Sync using subscription_id
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE 
      si.subscription_id = s.id 
      AND si.status NOT IN ('paid')
      AND si.amount != p.price;

    -- 2. Second attempt: Sync using tenant_id for invoices with NULL subscription_id
    -- or if the previous update missed it.
    -- We take the price of the plan in the tenant's current ACTIVE subscription.
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE 
      si.tenant_id = s.tenant_id
      AND s.status = 'active'
      AND si.status NOT IN ('paid')
      AND si.amount != p.price;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE 'Aggressive Manual Sync Invoices completed. Rows updated: %', v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manual sweep for all unpaid invoices to match the current plan price of their tenant's active sub
UPDATE public.subscription_invoices si
SET amount = p.price
FROM public.subscriptions s
JOIN public.plans p ON s.plan_id = p.id
WHERE 
  (si.subscription_id = s.id OR (si.tenant_id = s.tenant_id AND s.status = 'active'))
  AND si.status NOT IN ('paid')
  AND si.amount != p.price;
