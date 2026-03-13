-- Allow authenticated users to create tenants (for new signups)
CREATE POLICY "Users can create tenants" ON public.tenants
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own profile if tenant_id is NULL (initial setup)
CREATE POLICY "Users can update own profile during onboarding" ON public.profiles
    FOR UPDATE
    USING (id = auth.uid() AND tenant_id IS NULL)
    WITH CHECK (id = auth.uid());

-- Update handle_new_user to be more robust and set default role to 'admin' for new signups
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
        COALESCE(new.raw_user_meta_data->>'role', 'admin') -- Default to admin for new signups (self-service)
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
