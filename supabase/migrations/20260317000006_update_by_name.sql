DO $$
DECLARE
    v_id uuid;
    v_price numeric;
BEGIN
    SELECT id INTO v_id FROM public.plans WHERE name = 'Plano Premium' LIMIT 1;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'Plan with name Plano Premium NOT FOUND!';
    END IF;
    
    UPDATE public.plans SET price = 999 WHERE id = v_id;
    SELECT price INTO v_price FROM public.plans WHERE id = v_id;
    
    IF v_price = 999 THEN
        RAISE NOTICE 'Update successful for ID %', v_id;
    ELSE
        RAISE EXCEPTION 'Update FAILED for ID %! Current price: %', v_id, v_price;
    END IF;
END $$;
