
-- One-time script to activate subscriptions for all existing PAID invoices
-- This ensures the UI reflects the current plan and the sync logic works.
INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
SELECT 
    si.tenant_id, 
    si.plan_id, 
    'active', 
    COALESCE(si.payment_date, si.created_at), 
    COALESCE(si.payment_date, si.created_at) + interval '1 month'
FROM public.subscription_invoices si
WHERE si.status = 'paid' AND si.plan_id IS NOT NULL
ON CONFLICT (tenant_id) DO UPDATE 
SET plan_id = EXCLUDED.plan_id,
    status = 'active',
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end;

-- Final sync attempt to fix the 499 -> 600 case once and for all
UPDATE public.subscription_invoices si
SET amount = p.price
FROM public.plans p
WHERE 
  si.plan_id = p.id
  AND si.status NOT IN ('paid')
  AND si.amount != p.price;
