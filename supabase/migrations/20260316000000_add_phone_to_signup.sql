-- Update handle_new_user to include phone from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, phone, tenant_id, role)
    VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'full_name', 
        new.raw_user_meta_data->>'phone',
        CASE 
            WHEN new.raw_user_meta_data->>'tenant_id' IS NULL OR new.raw_user_meta_data->>'tenant_id' = '' THEN NULL 
            ELSE (new.raw_user_meta_data->>'tenant_id')::uuid 
        END,
        COALESCE(new.raw_user_meta_data->>'role', 'user')
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
