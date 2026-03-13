-- Fix specific user with null tenant_id by assigning them to a new Tenant
-- User ID: bb41f1f3-5af5-4060-8592-a0a23d7bf6f5 (Aurilene Andrade)

DO $$ 
DECLARE 
    v_user_id UUID := 'bb41f1f3-5af5-4060-8592-a0a23d7bf6f5';
    v_tenant_id UUID;
BEGIN
    -- 1. Check if user exists in profiles
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
        
        -- 2. Create a new Tenant for this user (since they are Admin)
        INSERT INTO public.tenants (name, slug, document, phone)
        VALUES (
            'SMS Anajás', 
            'sms-anajas', 
            '03351126255',
            '91985958042'
        )
        RETURNING id INTO v_tenant_id;

        -- 3. Update the profile with the new tenant_id
        UPDATE public.profiles 
        SET tenant_id = v_tenant_id
        WHERE id = v_user_id;
        
        RAISE NOTICE 'User % updated with new tenant %', v_user_id, v_tenant_id;
    ELSE
        RAISE NOTICE 'User % not found in profiles', v_user_id;
    END IF;
END $$;
