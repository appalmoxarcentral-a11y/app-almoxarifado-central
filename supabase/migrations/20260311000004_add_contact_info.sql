-- Add phone and address fields to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Add phone field to profiles table if not exists (for personal contact)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Update RLS policies to allow users to update their own tenant details
-- This is crucial for the subscription flow where users input their details
DROP POLICY IF EXISTS "Users can update their own tenant" ON public.tenants;
CREATE POLICY "Users can update their own tenant" ON public.tenants
    FOR UPDATE
    USING (id = public.get_current_tenant_id())
    WITH CHECK (id = public.get_current_tenant_id());
