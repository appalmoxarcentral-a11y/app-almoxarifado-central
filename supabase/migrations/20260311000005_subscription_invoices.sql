-- Create Invoices table to track payment history and PIX data
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
    subscription_id UUID REFERENCES public.subscriptions(id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, expired
    pix_code TEXT, -- The Copy and Paste PIX code
    pix_qr_code_url TEXT, -- URL to the QR Code image (optional, if n8n returns it)
    payment_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies for invoices
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view invoices of their tenant" ON public.subscription_invoices;
CREATE POLICY "Users can view invoices of their tenant" ON public.subscription_invoices
    FOR SELECT USING (tenant_id = public.get_current_tenant_id());

-- Allow creating invoices (for the checkout flow)
DROP POLICY IF EXISTS "Users can create invoices for their tenant" ON public.subscription_invoices;
CREATE POLICY "Users can create invoices for their tenant" ON public.subscription_invoices
    FOR INSERT 
    WITH CHECK (tenant_id = public.get_current_tenant_id());
