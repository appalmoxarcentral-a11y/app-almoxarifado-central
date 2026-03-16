
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

      // 3. Buscar todos os estoques da unidade de uma vez (mais eficiente)
      const [entradasRes, saidasRes] = await Promise.all([
        supabase
          .from('entradas_produtos')
          .select('produto_id, quantidade')
          .eq('unidade_id', unidadeId),
        supabase
          .from('dispensacoes')
          .select('produto_id, quantidade')
          .eq('unidade_id', unidadeId)
      ]);

      const estoqueMap = new Map<string, number>();

      // Somar entradas
      entradasRes.data?.forEach(e => {
        const atual = estoqueMap.get(e.produto_id) || 0;
        estoqueMap.set(e.produto_id, atual + (e.quantidade || 0));
      });

      // Subtrair saídas
      saidasRes.data?.forEach(s => {
        const atual = estoqueMap.get(s.produto_id) || 0;
        estoqueMap.set(s.produto_id, atual - (s.quantidade || 0));
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
