ALTER TABLE public.subscription_invoices ADD COLUMN IF NOT EXISTS next_cycle_date timestamp with time zone;
