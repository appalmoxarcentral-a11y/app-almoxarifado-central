-- Consolidated Migration Script (00_MIGRACAO_TOTAL.sql)
-- This file contains the final optimized schema and logic for the system.
-- It integrates all fixes for stock management, user isolation, and security.

-- ==========================================
-- 1. CLEANUP LEGACY OBJECTS
-- ==========================================
DO $$
BEGIN
    -- Drop old triggers to avoid duplicates
    DROP TRIGGER IF EXISTS trigger_entrada_produto ON public.entradas_produtos;
    DROP TRIGGER IF EXISTS trigger_entrada_produto_unico ON public.entradas_produtos;
    DROP TRIGGER IF EXISTS trigger_dispensacao_estoque ON public.dispensacoes;
    DROP TRIGGER IF EXISTS trigger_dispensacao_unica ON public.dispensacoes;
    
    -- Drop old table if it's deprecated
    DROP TABLE IF EXISTS public.usuarios CASCADE;
    DROP TYPE IF EXISTS public.tipo_usuario CASCADE;
    
    -- Handle produtos vs produtos_master
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos_master') THEN
        DROP TABLE IF EXISTS public.produtos CASCADE;
        ALTER TABLE public.produtos_master RENAME TO produtos;
    END IF;
    
    -- Ensure estoque_atual exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'produtos' AND column_name = 'estoque_atual') THEN
        ALTER TABLE public.produtos ADD COLUMN estoque_atual INTEGER DEFAULT 0;
    END IF;
END $$;

-- ==========================================
-- 2. ROBUST SECURITY HELPER FUNCTIONS (SECURITY DEFINER)
-- ==========================================
-- These bypass RLS internally to avoid infinite recursion loops.

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_tenant()
RETURNS uuid AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        public.get_auth_tenant(),
        '00000000-0000-0000-0000-000000000000'::uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. UNIFIED RLS POLICIES (JWT + FUNCTION BASED)
-- ==========================================

-- Profiles: View team and manage unit
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
    CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_super_admin() OR tenant_id = public.get_auth_tenant());
    
    DROP POLICY IF EXISTS "profiles_manage_policy" ON public.profiles;
    CREATE POLICY "profiles_manage_policy" ON public.profiles FOR ALL TO authenticated
    USING (public.is_super_admin() OR (public.get_auth_role() = 'admin' AND tenant_id = public.get_auth_tenant()));
END $$;

-- Entries & Dispensations: PRIVATE ISOLATION (Each user sees their own)
-- Note: Super Admin sees everything for audit.
ALTER TABLE public.entradas_produtos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "User Isolation" ON public.entradas_produtos;
    CREATE POLICY "User Isolation" ON public.entradas_produtos FOR ALL TO authenticated
    USING (public.is_super_admin() OR (tenant_id = public.get_current_tenant_id() AND usuario_id = auth.uid()));
END $$;

ALTER TABLE public.dispensacoes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "User Isolation" ON public.dispensacoes;
    CREATE POLICY "User Isolation" ON public.dispensacoes FOR ALL TO authenticated
    USING (public.is_super_admin() OR (tenant_id = public.get_current_tenant_id() AND usuario_id = auth.uid()));
END $$;

-- Shared Data: Products & Patients (Collaborative within Tenant)
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.produtos;
    CREATE POLICY "Tenant Isolation" ON public.produtos FOR ALL TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());
END $$;

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.pacientes;
    CREATE POLICY "Tenant Isolation" ON public.pacientes FOR ALL TO authenticated
    USING (public.is_super_admin() OR tenant_id = public.get_current_tenant_id());
END $$;

-- ==========================================
-- 4. AUTOMATIC STOCK CALCULATION TRIGGERS
-- ==========================================

-- Entry Stock Handler (INSERT, UPDATE, DELETE)
CREATE OR REPLACE FUNCTION public.atualizar_estoque_entrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.produtos SET estoque_atual = estoque_atual + NEW.quantidade WHERE id = NEW.produto_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE public.produtos SET estoque_atual = estoque_atual - OLD.quantidade + NEW.quantidade WHERE id = NEW.produto_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.produtos SET estoque_atual = estoque_atual - OLD.quantidade WHERE id = OLD.produto_id;
    END IF;
    RETURN NULL;
END;
$$;

-- Dispensation Stock Handler (INSERT)
CREATE OR REPLACE FUNCTION public.atualizar_estoque_dispensacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_estoque integer;
BEGIN
    SELECT estoque_atual INTO v_estoque FROM public.produtos WHERE id = NEW.produto_id;
    IF v_estoque < NEW.quantidade THEN RAISE EXCEPTION 'Estoque insuficiente'; END IF;
    UPDATE public.produtos SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.produto_id;
    RETURN NULL;
END;
$$;

-- Activate Triggers
CREATE TRIGGER trigger_entrada_final AFTER INSERT OR UPDATE OR DELETE ON public.entradas_produtos FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_entrada();
CREATE TRIGGER trigger_dispensacao_final AFTER INSERT ON public.dispensacoes FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_dispensacao();
