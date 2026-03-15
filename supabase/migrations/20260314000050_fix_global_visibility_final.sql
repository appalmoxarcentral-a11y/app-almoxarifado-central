-- FIX TOTAL E DEFINITIVO: Visibilidade Global de Produtos e Pacientes (Isolamento por Unidade REMOVIDO)
-- Este script limpa TODA E QUALQUER restrição de unidade para as tabelas de cadastros.
-- Garante que todos da mesma prefeitura (Tenant) vejam os mesmos cadastros, independentemente da unidade.

DO $$ 
DECLARE 
    master_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
    t text;
    p_record record;
    global_tables text[] := ARRAY['produtos', 'pacientes'];
BEGIN
    -- 1. Iterar sobre as tabelas globais (Produtos e Pacientes)
    FOREACH t IN ARRAY global_tables LOOP
        -- 1.1 Remover TODAS as políticas existentes (independente do nome)
        FOR p_record IN (SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public') LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_record.policyname, t);
        END LOOP;
        
        -- 1.2 Garantir que RLS está habilitado
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- 1.3 Criar POLÍTICA DE LEITURA TOTAL (Mesmo Município OU Master)
        -- Esta regra permite que QUALQUER unidade veja os itens, ignorando o unidade_id
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

        -- 1.4 Criar POLÍTICA DE MANIPULAÇÃO TOTAL (Mesmo Município)
        -- Permite inserir/editar se pertencer ao mesmo município
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

        -- 1.5 Remover Triggers que forçam o unidade_id (importante!)
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_unit_and_tenant_id ON public.%I', t);
        EXECUTE format('DROP TRIGGER IF EXISTS tr_set_rascunho_unidade_id ON public.%I', t);
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_tenant_only ON public.%I', t);
        
        -- 1.6 Criar Trigger que força APENAS o tenant_id (Município), limpando o unidade_id se vier preenchido
        -- Isso garante que o produto/paciente não fique "preso" a uma unidade
        EXECUTE format('
            CREATE OR REPLACE FUNCTION public.force_tenant_no_unit()
            RETURNS TRIGGER AS $func$
            BEGIN
                IF NEW.tenant_id IS NULL THEN
                    NEW.tenant_id := public.get_current_tenant_id();
                END IF;
                -- Limpamos o unidade_id para garantir que não haja filtros de unidade acidentais
                NEW.unidade_id := NULL;
                RETURN NEW;
            END;
            $func$ LANGUAGE plpgsql SECURITY DEFINER;
        ');
        
        EXECUTE format('
            CREATE TRIGGER trigger_force_tenant_no_unit 
            BEFORE INSERT OR UPDATE ON public.%I 
            FOR EACH ROW EXECUTE FUNCTION public.force_tenant_no_unit()
        ', t);

        RAISE NOTICE 'Isolamento de Unidade REMOVIDO com sucesso da tabela: %', t;
    END LOOP;
END $$;

-- 2. Limpeza de dados: Remover unidade_id de produtos e pacientes existentes
-- Isso garante que filtros antigos não funcionem por causa de dados residuais
UPDATE public.produtos SET unidade_id = NULL;
UPDATE public.pacientes SET unidade_id = NULL;
