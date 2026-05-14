
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseItem } from '@/types/purchase';

export function usePurchaseData(overrideUnidadeId?: string) {
  const { data: produtos, isLoading, error } = useQuery({
    queryKey: ['purchase-products', overrideUnidadeId],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // 1. Obter a unidade ID a ser usada (Destino)
      let unidadeId = overrideUnidadeId;

      if (!unidadeId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { data: profile } = await supabase
          .from('profiles')
          .select('unidade_id')
          .eq('id', user.id)
          .single();
        unidadeId = profile?.unidade_id;
      }

      // ID fixo do Almoxarifado Central (Origem)
      const CENTRAL_ID = '9dce634a-7ee1-46b2-92e6-916f5789875c';

      // 2. Buscar produtos
      const { data: produtosData, error: prodError } = await supabase
        .from('produtos')
        .select('*')
        .order('descricao');

      if (prodError) throw prodError;

      // 3. Buscar estoques da unidade de destino e do central de uma vez
      const unitsToFetch = [unidadeId];
      if (unidadeId !== CENTRAL_ID) {
        unitsToFetch.push(CENTRAL_ID);
      }

      const { data: estoqueData, error: estoqueErr } = await supabase
        .from('produtos_estoque')
        .select('produto_id, estoque_atual, unidade_id')
        .in('unidade_id', unitsToFetch.filter(Boolean) as string[]);

      if (estoqueErr) throw estoqueErr;

      const estoqueDestinoMap = new Map<string, number>();
      const estoqueOrigemMap = new Map<string, number>();

      estoqueData?.forEach(e => {
        if (e.unidade_id === unidadeId) {
          estoqueDestinoMap.set(e.produto_id, e.estoque_atual);
        }
        if (e.unidade_id === CENTRAL_ID) {
          estoqueOrigemMap.set(e.produto_id, e.estoque_atual);
        }
      });

      // 4. Montar a lista final
      return produtosData.map(produto => ({
        id: produto.id,
        codigo: produto.codigo,
        descricao: produto.descricao,
        unidade_medida: produto.unidade_medida,
        estoque_atual: estoqueDestinoMap.get(produto.id) || 0,
        estoque_origem: estoqueOrigemMap.get(produto.id) || 0,
        quantidade_reposicao: undefined
      })) as PurchaseItem[];
    }
  });

  return {
    produtos: produtos || [],
    isLoading,
    error
  };
}
