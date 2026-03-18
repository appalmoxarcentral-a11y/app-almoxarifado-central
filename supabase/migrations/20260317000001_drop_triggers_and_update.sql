DROP TRIGGER IF EXISTS tr_sync_invoice_amounts ON public.plans;
DROP TRIGGER IF EXISTS tr_sync_invoices_on_plan_price_change ON public.plans;

UPDATE public.plans SET price = 999, max_users = 999, max_products = 9999 WHERE id = '00000000-0000-0000-0000-000000000001';
