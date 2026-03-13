-- Fix all foreign keys and missing columns for proper multi-tenancy and user management
-- as 'usuarios' table is deprecated in favor of 'profiles' table.

DO $$
BEGIN
    -- 2. Switch all foreign keys from 'usuarios' to 'profiles'
    
    -- entradas_produtos
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'entradas_produtos_usuario_id_fkey') THEN
        ALTER TABLE public.entradas_produtos DROP CONSTRAINT entradas_produtos_usuario_id_fkey;
        ALTER TABLE public.entradas_produtos ADD CONSTRAINT entradas_produtos_usuario_id_fkey 
            FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- dispensacoes
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'dispensacoes_usuario_id_fkey') THEN
        ALTER TABLE public.dispensacoes DROP CONSTRAINT dispensacoes_usuario_id_fkey;
        ALTER TABLE public.dispensacoes ADD CONSTRAINT dispensacoes_usuario_id_fkey 
            FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;

    -- logs_sistema
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'logs_sistema_usuario_id_fkey') THEN
        ALTER TABLE public.logs_sistema DROP CONSTRAINT logs_sistema_usuario_id_fkey;
        ALTER TABLE public.logs_sistema ADD CONSTRAINT logs_sistema_usuario_id_fkey 
            FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- 3. Sync current logged users to public.profiles if they exist in auth.users but not in profiles
    INSERT INTO public.profiles (id, email, full_name, tenant_id, role)
    SELECT 
        au.id, 
        au.email, 
        COALESCE(au.raw_user_meta_data->>'full_name', 'Usuário'),
        COALESCE((au.raw_user_meta_data->>'tenant_id')::uuid, '00000000-0000-0000-0000-000000000000'),
        COALESCE(au.raw_user_meta_data->>'role', 'user')
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
    ON CONFLICT (id) DO NOTHING;

    -- 4. Sync profiles to legacy usuarios table (as fallback)
    -- This ensures that any logic still looking at the 'usuarios' table won't break
    INSERT INTO public.usuarios (id, nome, email, senha, tipo, ativo)
    SELECT 
        id, 
        COALESCE(full_name, 'Usuário'), 
        email, 
        'legacy_auth', -- dummy password for deprecated table
        CASE WHEN role = 'super_admin' THEN 'ADMIN'::tipo_usuario ELSE 'COMUM'::tipo_usuario END,
        true
    FROM public.profiles
    ON CONFLICT (id) DO NOTHING;

END $$;
