-- Add pix_id column to subscription_invoices table for transaction tracking
ALTER TABLE public.subscription_invoices
ADD COLUMN IF NOT EXISTS pix_id TEXT;
