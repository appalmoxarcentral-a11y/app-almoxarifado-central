-- 1. Update function to check if tenant is blocked
-- Now only 'pending' invoices block the system. 'waiting' and 'paid' do not block.
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Blocked ONLY if has any 'pending' invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update automatic next invoice generation trigger
-- When an invoice is paid, generate the next one as 'waiting' (Aguardando)
CREATE OR REPLACE FUNCTION public.handle_next_invoice_generation()
RETURNS TRIGGER AS $$
DECLARE
    v_next_due_date TIMESTAMP WITH TIME ZONE;
    v_current_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only trigger when status changes from anything to paid
    IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
        -- The "Vencimento Atual" of the new invoice should be the "Próximo Vencimento" of the paid one
        v_current_due_date := NEW.due_date;
        -- The "Próximo Vencimento" of the new invoice should be 30 days after the generation date (now)
        v_next_due_date := timezone('utc'::text, now()) + interval '30 days';
        
        -- Check if a pending or waiting invoice already exists for this tenant to avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.subscription_invoices 
            WHERE tenant_id = NEW.tenant_id AND status IN ('pending', 'waiting')
        ) THEN
            INSERT INTO public.subscription_invoices (tenant_id, amount, status, created_at, due_date)
            VALUES (NEW.tenant_id, NEW.amount, 'waiting', v_current_due_date, v_next_due_date);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_generate_next_invoice ON public.subscription_invoices;
CREATE TRIGGER tr_generate_next_invoice
    AFTER UPDATE ON public.subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_next_invoice_generation();
