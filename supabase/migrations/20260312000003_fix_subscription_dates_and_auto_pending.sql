-- 1. Update trigger to correctly replicate dates and set status to 'waiting'
CREATE OR REPLACE FUNCTION public.handle_next_invoice_generation()
RETURNS TRIGGER AS $$
DECLARE
    v_next_due_date TIMESTAMP WITH TIME ZONE;
    v_current_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only trigger when status changes from anything to paid
    IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
        -- The "Vencimento Atual" of the new invoice should be the "Próximo Vencimento" of the paid one
        -- Normalizar para Meio-Dia (12:00 UTC) para evitar saltos de data
        v_current_due_date := date_trunc('day', NEW.due_date) + interval '12 hours';
        -- The "Próximo Vencimento" of the new invoice should be 1 month after the new "Vencimento Atual"
        v_next_due_date := v_current_due_date + interval '1 month';
        
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

-- 2. Update block check function to automatically transition expired 'waiting' invoices to 'pending'
-- This ensures the block is applied as soon as the date passes
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- First, automatically update any 'waiting' invoice that has passed its due date to 'pending'
    -- Note: We use 'created_at' as the start of the period (Vencimento Atual) 
    -- and 'due_date' as the end (Próximo Vencimento).
    -- If current time is past 'created_at' (the start of the period for the new invoice), it should become pending.
    -- Wait, if it's 'Aguardando', it's for the FUTURE period. 
    -- It should become 'Pendente' only when the current date reaches the "Vencimento Atual" (created_at).
    UPDATE public.subscription_invoices
    SET status = 'pending'
    WHERE tenant_id = p_tenant_id 
      AND status = 'waiting' 
      AND created_at <= timezone('utc'::text, now());

    -- Blocked ONLY if has any 'pending' invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
