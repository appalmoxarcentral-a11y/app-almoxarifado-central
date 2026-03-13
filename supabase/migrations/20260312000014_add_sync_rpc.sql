
-- RPC to sync all unpaid invoices with their current plan prices
CREATE OR REPLACE FUNCTION public.sync_all_unpaid_invoices()
RETURNS void AS $$
BEGIN
    -- This uses the same logic as the trigger manual sync part
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE 
      (si.subscription_id = s.id OR (si.subscription_id IS NULL AND si.tenant_id = s.tenant_id))
      AND s.status = 'active'
      AND si.status != 'paid'
      AND si.amount != p.price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
