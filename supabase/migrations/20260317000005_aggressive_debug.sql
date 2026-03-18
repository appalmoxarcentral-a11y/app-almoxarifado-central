DO $$
DECLARE
    v_price numeric;
BEGIN
    UPDATE public.plans SET price = 999 WHERE id = '00000000-0000-0000-0000-000000000001';
    SELECT price INTO v_price FROM public.plans WHERE id = '00000000-0000-0000-0000-000000000001';
    IF v_price = 999 THEN
        RAISE NOTICE 'Update successful inside transaction';
    ELSE
        RAISE EXCEPTION 'Update FAILED inside transaction! Current price: %', v_price;
    END IF;
END $$;
