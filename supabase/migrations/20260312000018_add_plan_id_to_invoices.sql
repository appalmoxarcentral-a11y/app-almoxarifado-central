
-- 1. Add plan_id to subscription_invoices to ensure we know which plan an invoice is for
ALTER TABLE public.subscription_invoices ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.plans(id);

-- 2. Try to sync existing invoices with plan_id based on amount (heuristic)
-- This will help correct Row 1 and Row 2 in the user's image
UPDATE public.subscription_invoices si
SET plan_id = p.id
FROM public.plans p
WHERE 
  si.plan_id IS NULL
  AND (si.amount = p.price OR (p.name = 'Empresarial' AND si.amount = 499)); -- Heuristic: 499 was the old Empresarial price

-- 3. Create or Update a robust trigger to handle subscription creation/update on payment
CREATE OR REPLACE FUNCTION public.handle_subscription_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- When an invoice is marked as PAID
    IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
        -- If it's a new subscription or an upgrade/renewal
        IF NEW.plan_id IS NOT NULL THEN
            -- Update or Create the subscription
            INSERT INTO public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
            VALUES (
                NEW.tenant_id, 
                NEW.plan_id, 
                'active', 
                now(), 
                now() + interval '1 month'
            )
            ON CONFLICT (tenant_id) DO UPDATE -- Assuming unique constraint on tenant_id
            SET plan_id = EXCLUDED.plan_id,
                status = 'active',
                current_period_start = now(),
                current_period_end = now() + interval '1 month';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ensure the subscriptions table has a unique constraint on tenant_id (one active sub per tenant)
-- (We might need to check if multiple subs exist first, but for now we'll try to enforce it)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_tenant_id_key') THEN
        ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_tenant_id_key UNIQUE (tenant_id);
    END IF;
END $$;

-- 5. Attach trigger
DROP TRIGGER IF EXISTS tr_handle_subscription_on_payment ON public.subscription_invoices;
CREATE TRIGGER tr_handle_subscription_on_payment
    AFTER UPDATE ON public.subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_subscription_on_payment();

-- 6. Refine sync_all_unpaid_invoices to be even simpler and more direct
CREATE OR REPLACE FUNCTION public.sync_all_unpaid_invoices()
RETURNS void AS $$
BEGIN
    -- Update based on plan_id directly
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.plans p
    WHERE 
      si.plan_id = p.id
      AND si.status NOT IN ('paid')
      AND si.amount != p.price;

    -- Update based on current subscription as fallback
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE 
      (si.subscription_id = s.id OR (si.tenant_id = s.tenant_id AND s.status = 'active'))
      AND si.status NOT IN ('paid')
      AND si.amount != p.price;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
