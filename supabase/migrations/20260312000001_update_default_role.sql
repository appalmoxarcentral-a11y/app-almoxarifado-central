-- Update handle_new_user to set default role to 'user' instead of 'admin'
-- This ensures that new signups are regular members by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        CASE 
            WHEN new.raw_user_meta_data->>'tenant_id' IS NULL OR new.raw_user_meta_data->>'tenant_id' = '' THEN NULL 
            ELSE (new.raw_user_meta_data->>'tenant_id')::uuid 
        END,
        COALESCE(new.raw_user_meta_data->>'role', 'user') -- Changed from 'admin' to 'user'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
