DO $$
DECLARE
    v_count int;
BEGIN
    UPDATE public.plans SET price = 999 WHERE id = '00000000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows', v_count;
END $$;
