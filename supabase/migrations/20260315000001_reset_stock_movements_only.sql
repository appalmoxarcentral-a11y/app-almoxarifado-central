-- SQL para zerar APENAS Entradas e Saídas (Dispensações) de todas as unidades
-- Este script remove apenas os registros de movimentação de estoque, limpando os históricos.

DO $$ 
DECLARE 
    t text;
    -- Tabelas de movimentação de estoque
    tables text[] := ARRAY[
        'entradas_produtos', 
        'dispensacoes'
    ];
BEGIN
    -- 1. Limpar apenas as tabelas de entradas e saídas
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('TRUNCATE TABLE public.%I CASCADE', t);
            RAISE NOTICE 'Tabela % zerada com sucesso.', t;
        END IF;
    END LOOP;

    -- 2. Resetar o campo estoque_atual na tabela de produtos para 0
    -- Isso garante que a interface reflita que não há estoque em nenhuma unidade
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'produtos') THEN
        UPDATE public.produtos SET estoque_atual = 0;
        RAISE NOTICE 'Estoque dos produtos resetado para 0.';
    END IF;

    RAISE NOTICE 'Reset concluído: Entradas e Saídas apagadas. Históricos limpos.';
END $$;
