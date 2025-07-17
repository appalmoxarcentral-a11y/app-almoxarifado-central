-- Correção das funções restantes para segurança completa
CREATE OR REPLACE FUNCTION public.atualizar_estoque_entrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.produtos 
  SET estoque_atual = estoque_atual + NEW.quantidade 
  WHERE id = NEW.produto_id;
  
  INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes)
  VALUES (NEW.usuario_id, 'ENTRADA_PRODUTO', 'entradas_produtos', 
          json_build_object(
            'produto_id', NEW.produto_id,
            'quantidade', NEW.quantidade,
            'lote', NEW.lote
          ));
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_estoque_dispensacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Verificar se há estoque suficiente
  IF (SELECT estoque_atual FROM public.produtos WHERE id = NEW.produto_id) < NEW.quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente para dispensação';
  END IF;
  
  UPDATE public.produtos 
  SET estoque_atual = estoque_atual - NEW.quantidade 
  WHERE id = NEW.produto_id;
  
  INSERT INTO public.logs_sistema (usuario_id, acao, tabela, detalhes)
  VALUES (NEW.usuario_id, 'DISPENSACAO', 'dispensacoes', 
          json_build_object(
            'paciente_id', NEW.paciente_id,
            'produto_id', NEW.produto_id,
            'quantidade', NEW.quantidade,
            'lote', NEW.lote
          ));
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_rascunhos_compras_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.data_atualizacao = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_relatorio_compras_rascunho_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  NEW.data_atualizacao = now();
  RETURN NEW;
END;
$$;