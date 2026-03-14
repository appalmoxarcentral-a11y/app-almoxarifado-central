-- Trigger function to log unit changes
CREATE OR REPLACE FUNCTION public.log_unidade_vinculo_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if the unidade_id has changed
    IF (OLD.unidade_id IS DISTINCT FROM NEW.unidade_id) THEN
        INSERT INTO public.audit_vinculos_unidade (
            usuario_id,
            admin_id,
            unidade_anterior_id,
            unidade_nova_id,
            motivo
        )
        VALUES (
            NEW.id,
            auth.uid(), -- The admin/user who performed the update
            OLD.unidade_id,
            NEW.unidade_id,
            'Alteração de vínculo via sistema'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the profiles table
DROP TRIGGER IF EXISTS trigger_audit_unidade_change ON public.profiles;
CREATE TRIGGER trigger_audit_unidade_change
    AFTER UPDATE OF unidade_id ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.log_unidade_vinculo_change();
