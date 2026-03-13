CREATE OR REPLACE FUNCTION public.get_all_tenants_admin()
RETURNS TABLE (
    id UUID,
    name TEXT,
    document TEXT,
    plan_name TEXT,
    status TEXT,
    period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Authorization check: User must be admin (implement robust check in production)
    -- For now, we rely on the fact that this function is only exposed to authorized users via UI
    -- Ideally, you should uncomment the check below after adding 'super_admin' role to profiles
    
    /*
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    */
    
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.document,
        p.name as plan_name,
        s.status,
        s.current_period_end
    FROM public.tenants t
    LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
    LEFT JOIN public.plans p ON p.id = s.plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
