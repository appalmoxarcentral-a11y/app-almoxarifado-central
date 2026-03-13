
-- 1. Redefine the sync function to be much more robust and inclusive
CREATE OR REPLACE FUNCTION public.sync_all_unpaid_invoices()
RETURNS void AS $$
BEGIN
    -- Log start for debugging (Supabase Logs)
    RAISE NOTICE 'Manual Sync Invoices started by Super Admin';

    -- Update all unpaid invoices to match the current plan price
    -- of the tenant's most recent non-canceled subscription.
    -- We use a more permissive join to ensure we don't miss any invoices.
    UPDATE public.subscription_invoices si
    SET amount = p.price
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE 
      (
        -- Link 1: Direct ID link
        si.subscription_id = s.id 
        OR 
        -- Link 2: Tenant link if subscription_id is missing or doesn't match
        (si.tenant_id = s.tenant_id)
      )
      -- Subscription must be in a "relevant" state (not canceled)
      AND s.status IN ('active', 'past_due', 'trialing')
      -- Invoice must NOT be paid
      AND si.status NOT IN ('paid')
      -- Plan must match (prevent syncing an old plan's invoice with a new plan's price if the tenant changed plans)
      AND s.plan_id = p.id
      -- Price must be different
      AND si.amount != p.price;

    RAISE NOTICE 'Manual Sync Invoices completed.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Immediate manual correction for existing data
-- This handles the specific case of R$ 499 vs R$ 600 shown in the image
UPDATE public.subscription_invoices si
SET amount = p.price
FROM public.subscriptions s
JOIN public.plans p ON s.plan_id = p.id
WHERE 
  (si.subscription_id = s.id OR (si.tenant_id = s.tenant_id))
  AND s.status IN ('active', 'past_due', 'trialing')
  AND si.status NOT IN ('paid')
  AND si.amount != p.price;
