-- Atualiza a trigger que gera a nova fatura automaticamente
-- Agora ela copia o plan_id, subscription_id e calcula o next_cycle_date corretamente

CREATE OR REPLACE FUNCTION public.handle_next_invoice_generation()
RETURNS TRIGGER AS $$
DECLARE
    v_next_due_date TIMESTAMP WITH TIME ZONE;
    v_next_cycle_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Only trigger when status changes from pending/failed/waiting to paid
    IF (OLD.status != 'paid' AND NEW.status = 'paid') THEN
        -- Calculate next due date (1 month after current due date)
        v_next_due_date := NEW.due_date + interval '1 month';
        v_next_cycle_date := v_next_due_date + interval '1 month';
        
        -- Check if a waiting/pending invoice already exists for this tenant to avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM public.subscription_invoices 
            WHERE tenant_id = NEW.tenant_id AND status IN ('pending', 'waiting')
        ) THEN
            INSERT INTO public.subscription_invoices (
                tenant_id, 
                subscription_id,
                plan_id,
                amount, 
                status, 
                due_date,
                next_cycle_date
            )
            VALUES (
                NEW.tenant_id, 
                NEW.subscription_id,
                NEW.plan_id,
                NEW.amount, 
                'waiting', 
                v_next_due_date,
                v_next_cycle_date
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
