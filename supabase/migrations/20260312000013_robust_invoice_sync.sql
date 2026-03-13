
-- Migration to force sync invoice amounts with current plan prices
-- and ensure future updates are robust.

-- 1. Manual update for all unpaid invoices to match current plan price
UPDATE public.subscription_invoices si
SET amount = p.price
FROM public.subscriptions s
JOIN public.plans p ON s.plan_id = p.id
WHERE 
  (si.subscription_id = s.id OR (si.subscription_id IS NULL AND si.tenant_id = s.tenant_id))
  AND s.status = 'active'
  AND si.status != 'paid'
  AND si.amount != p.price;

-- 2. Update the trigger function to be even more aggressive and robust
CREATE OR REPLACE FUNCTION public.sync_invoice_amounts_on_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if the price has changed
    IF (OLD.price IS DISTINCT FROM NEW.price) THEN
        -- Log the update (will appear in Supabase logs)
        RAISE NOTICE 'Plan % price changed from % to %. Syncing invoices...', NEW.name, OLD.price, NEW.price;

        -- Update all invoices that are not paid for this specific plan
        -- We join with subscriptions by plan_id
        UPDATE public.subscription_invoices si
        SET amount = NEW.price
        WHERE si.status != 'paid'
          AND (
            -- Either linked via subscription_id that points to this plan
            EXISTS (
              SELECT 1 FROM public.subscriptions s 
              WHERE s.id = si.subscription_id AND s.plan_id = NEW.id
            )
            OR
            -- Or linked via tenant_id that HAS an active subscription to this plan
            (si.subscription_id IS NULL AND EXISTS (
              SELECT 1 FROM public.subscriptions s 
              WHERE s.tenant_id = si.tenant_id AND s.plan_id = NEW.id AND s.status = 'active'
            ))
          );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure the trigger is properly attached to the plans table
DROP TRIGGER IF EXISTS tr_sync_invoices_on_plan_price_change ON public.plans;
CREATE TRIGGER tr_sync_invoices_on_plan_price_change
AFTER UPDATE OF price ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.sync_invoice_amounts_on_plan_update();
