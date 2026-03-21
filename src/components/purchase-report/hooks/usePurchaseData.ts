
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseItem } from '@/types/purchase';

export function usePurchaseData(overrideUnidadeId?: string) {
  const { data: produtos, isLoading, error } = useQuery({
    queryKey: ['purchase-products', overrideUnidadeId],
    queryFn: async () => {
      // 1. Obter a unidade ID a ser usada
      let unidadeId = overrideUnidadeId;

      if (!unidadeId) {
        console.log('🔍 usePurchaseData: Buscando unidade_id do perfil do usuário');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { data: profile } = await supabase
          .from('profiles')
          .select('unidade_id')
          .eq('id', user.id)
          .single();
        unidadeId = profile?.unidade_id;
      }

      if (!unidadeId) {
        console.warn('⚠️ usePurchaseData: unidadeId não encontrado, usando filtro vazio');
      } else {
        console.log(`📊 usePurchaseData: Buscando estoque para unidade ${unidadeId}`);
      }

      // 2. Buscar produtos
      const { data: produtosData, error: prodError } = await supabase
        .from('produtos')
        .select('*')
        .order('descricao');

      if (prodError) throw prodError;

      // 3. Buscar todos os estoques da unidade de uma vez na tabela consolidada
      const { data: estoqueData, error: estoqueErr } = await supabase
        .from('produtos_estoque')
        .select('produto_id, estoque_atual')
        .eq('unidade_id', unidadeId);

      if (estoqueErr) throw estoqueErr;

      const estoqueMap = new Map<string, number>();
      estoqueData?.forEach(e => {
        estoqueMap.set(e.produto_id, e.estoque_atual);
      });

      // 4. Montar a lista final
      return produtosData.map(produto => ({
        id: produto.id,
        codigo: produto.codigo,
        descricao: produto.descricao,
        unidade_medida: produto.unidade_medida,
        estoque_atual: estoqueMap.get(produto.id) || 0,
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
