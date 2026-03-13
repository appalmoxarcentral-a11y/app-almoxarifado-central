-- Update function to check if tenant is blocked
-- Now all tenants (including legacy) are blocked if they have pending invoices
-- The bypass will be handled by the user role in the application/frontend
CREATE OR REPLACE FUNCTION public.is_tenant_blocked(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Blocked if has any pending invoice
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_invoices 
        WHERE tenant_id = p_tenant_id AND status = 'pending'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
