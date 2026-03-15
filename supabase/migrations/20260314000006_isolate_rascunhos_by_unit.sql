-- Migração para isolamento de rascunhos por unidade de saúde
-- Adiciona a coluna unidade_id e atualiza as políticas de RLS

DO $$ 
BEGIN
    -- 1. Adicionar coluna unidade_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rascunhos_compras' AND column_name = 'unidade_id') THEN
        ALTER TABLE public.rascunhos_compras ADD COLUMN unidade_id UUID REFERENCES public.unidades_saude(id);
        RAISE NOTICE 'Coluna unidade_id adicionada à tabela rascunhos_compras';
    END IF;
END $$;

-- 2. Função para obter a unidade_id do usuário logado de forma segura
CREATE OR REPLACE FUNCTION public.get_current_unidade_id()
RETURNS UUID AS $$
DECLARE
    v_unidade_id UUID;
BEGIN
    SELECT unidade_id INTO v_unidade_id FROM public.profiles WHERE id = auth.uid();
    RETURN v_unidade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger para preencher unidade_id automaticamente ao inserir
CREATE OR REPLACE FUNCTION public.trigger_set_rascunho_unidade_id()
RETURNS trigger AS $$
BEGIN
    IF NEW.unidade_id IS NULL THEN
        NEW.unidade_id := public.get_current_unidade_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_set_rascunho_unidade_id ON public.rascunhos_compras;
CREATE TRIGGER tr_set_rascunho_unidade_id
    BEFORE INSERT ON public.rascunhos_compras
    FOR EACH ROW EXECUTE FUNCTION public.trigger_set_rascunho_unidade_id();

-- 4. Atualizar as políticas de RLS para incluir isolamento por unidade
DROP POLICY IF EXISTS "Admin and User Isolation" ON public.rascunhos_compras;

CREATE POLICY "Unit and User Isolation" ON public.rascunhos_compras
FOR ALL
TO authenticated
USING (
    public.is_super_admin() OR 
    (
        tenant_id = public.get_current_tenant_id() AND 
        (
            public.get_auth_role() = 'admin' OR 
            (unidade_id = public.get_current_unidade_id())
        )
    )
)
WITH CHECK (
    public.is_super_admin() OR 
    (
        tenant_id = public.get_current_tenant_id() AND 
        (
            public.get_auth_role() = 'admin' OR 
            (unidade_id = public.get_current_unidade_id())
        )
    )
);

-- 5. Atualizar registros existentes (opcional, associa à unidade atual do dono do rascunho)
UPDATE public.rascunhos_compras r
SET unidade_id = p.unidade_id
FROM public.profiles p
WHERE r.usuario_id = p.id AND r.unidade_id IS NULL;
