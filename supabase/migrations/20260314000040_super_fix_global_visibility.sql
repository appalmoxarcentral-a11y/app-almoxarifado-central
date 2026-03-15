-- FIX DEFINITIVO: Visibilidade Global de Produtos e Pacientes
-- Garante que todos da mesma prefeitura (Tenant) vejam os mesmos cadastros, 
-- independentemente da unidade onde o item foi criado.

DO $$ 
DECLARE 
    master_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
    t text;
    p_name text;
    global_tables text[] := ARRAY['produtos', 'pacientes'];
BEGIN
    -- 1. Limpeza agressiva de TODAS as políticas existentes para evitar conflitos
    FOREACH t IN ARRAY global_tables LOOP
        FOR p_name IN (SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public') LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name, t);
        END LOOP;
        
        -- Garantir que RLS está ativo
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- 2. Criar política de VISUALIZAÇÃO GLOBAL (Mesmo Município + Catálogo Mestre)
        EXECUTE format('
            CREATE POLICY "Global_Read_Policy" ON public.%I
            FOR SELECT
            TO authenticated
            USING (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id() OR
                tenant_id = %L
            )
        ', t, master_tenant_id);

        -- 3. Criar política de GESTÃO (Inserir/Editar/Excluir) - Município
        EXECUTE format('
            CREATE POLICY "Global_Manage_Policy" ON public.%I
            FOR ALL 
            TO authenticated
            USING (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id()
            )
            WITH CHECK (
                public.is_super_admin() OR 
                tenant_id = public.get_current_tenant_id()
            )
        ', t);

        -- 4. Remover Trigger de Isolamento de Unidade (para estas tabelas, unidade_id não deve restringir)
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_unit_and_tenant_id ON public.%I', t);
        
        -- 5. Adicionar Trigger apenas para Tenant (Município)
        EXECUTE format('
            CREATE OR REPLACE FUNCTION public.set_tenant_only()
            RETURNS TRIGGER AS $func$
            BEGIN
                IF NEW.tenant_id IS NULL THEN
                    NEW.tenant_id := public.get_current_tenant_id();
                END IF;
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ');
        
        EXECUTE format('
            CREATE TRIGGER trigger_set_tenant_only 
            BEFORE INSERT ON public.%I 
            FOR EACH ROW EXECUTE FUNCTION public.set_tenant_only()
        ', t);

        RAISE NOTICE 'Fix Global aplicado à tabela: %', t;
    END LOOP;
END $$;
