-- Function to update invoice amounts when a plan price changes
CREATE OR REPLACE FUNCTION public.sync_invoice_amounts_on_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if the price has changed
    IF (OLD.price IS DISTINCT FROM NEW.price) THEN
        -- Update all invoices that are not paid
        -- We join with subscriptions by tenant_id to find invoices belonging to this plan
        UPDATE public.subscription_invoices si
        SET amount = NEW.price
        FROM public.subscriptions s
        WHERE si.tenant_id = s.tenant_id
          AND s.plan_id = NEW.id
          AND si.status != 'paid';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on the plans table
DROP TRIGGER IF EXISTS tr_sync_invoice_amounts ON public.plans;
CREATE TRIGGER tr_sync_invoice_amounts
    AFTER UPDATE OF price ON public.plans
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_invoice_amounts_on_plan_update();
