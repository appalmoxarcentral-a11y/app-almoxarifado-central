-- Function to update invoice amounts when a plan price changes
CREATE OR REPLACE FUNCTION public.sync_invoice_amounts_on_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if the price has changed
    IF (OLD.price IS DISTINCT FROM NEW.price) THEN
        -- Update all invoices that are not paid
        -- We join with subscriptions by subscription_id if available,
        -- or by tenant_id and plan_id as a fallback.
        UPDATE public.subscription_invoices si
        SET amount = NEW.price
        FROM public.subscriptions s
        WHERE 
          (
            -- Case 1: Direct link via subscription_id
            si.subscription_id = s.id
          )
          AND s.plan_id = NEW.id
          AND si.status != 'paid';
          
        -- Fallback for legacy invoices without subscription_id
        -- We can only guess based on the tenant having an active subscription to this plan
        UPDATE public.subscription_invoices si
        SET amount = NEW.price
        WHERE si.subscription_id IS NULL
          AND si.status != 'paid'
          AND EXISTS (
            SELECT 1 FROM public.subscriptions s
            WHERE s.tenant_id = si.tenant_id
              AND s.plan_id = NEW.id
              AND s.status = 'active'
          );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manual sync for existing invoices
UPDATE public.subscription_invoices si
SET amount = p.price
FROM public.subscriptions s
JOIN public.plans p ON s.plan_id = p.id
WHERE 
  (si.subscription_id = s.id OR (si.subscription_id IS NULL AND si.tenant_id = s.tenant_id))
  AND s.status = 'active'
  AND si.status != 'paid'
  AND si.amount != p.price;
