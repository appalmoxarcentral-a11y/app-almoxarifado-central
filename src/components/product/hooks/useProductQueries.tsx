
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types";
import { useToast } from "@/hooks/use-toast";

export const useProductQueries = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [unidadesMedida, setUnidadesMedida] = useState<{ value: string; label: string }[]>([]);

  const loadUnidadesMedida = async () => {
    try {
      const { data, error } = await supabase
        .from('unidades_medida')
        .select('codigo, descricao')
        .eq('ativo', true)
        .order('codigo');

      if (error) throw error;
      
      const unidades = data.map(unidade => ({
        value: unidade.codigo,
        label: `${unidade.codigo} - ${unidade.descricao}`
      }));
      
      setUnidadesMedida(unidades);
    } catch (error) {
      console.error('Erro ao carregar unidades de medida:', error);
      toast({
        title: "Erro ao carregar unidades de medida",
        description: "Usando unidades padrão como fallback.",
        variant: "destructive",
      });
    }
  };

  const loadProducts = async (search = '', page = 1) => {
    try {
      setIsSearching(true);
      setCurrentPage(page);
      
      // 1. Obter a unidade atual do usuário para o cálculo de estoque
      const { data: profile } = await supabase
        .from('profiles')
        .select('unidade_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const unidadeId = profile?.unidade_id;

      let query = supabase
        .from('produtos')
        .select(`
          *,
          tenant:tenant_id (
            name
          )
        `, { count: 'exact' });

      if (search) {
        // Busca por descrição ou código
        query = query.or(`descricao.ilike.%${search}%,codigo.ilike.%${search}%`);
      }

      // Paginação
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order('descricao', { ascending: true }) // Ordenar por nome facilita a navegação
        .range(from, to);

      if (error) throw error;
      
      // Atualiza o total
      if (count !== null) {
        setTotalProducts(count);
      }
      
      // 2. Calcular estoque real por unidade para cada produto da página atual
      const mappedProducts = await Promise.all((data || []).map(async (p) => {
        let estoqueCalculado = 0;

        if (unidadeId) {
          // Buscar soma de entradas nesta unidade
          const { data: entradas } = await supabase
            .from('entradas_produtos')
            .select('quantidade')
            .eq('produto_id', p.id)
            .eq('unidade_id', unidadeId);
          
          const totalEntradas = entradas?.reduce((sum, item) => sum + (item.quantidade || 0), 0) || 0;

          // Buscar soma de saídas nesta unidade
          const { data: dispensacoes } = await supabase
            .from('dispensacoes')
            .select('quantidade')
            .eq('produto_id', p.id)
            .eq('unidade_id', unidadeId);
          
          const totalSaidas = dispensacoes?.reduce((sum, item) => sum + (item.quantidade || 0), 0) || 0;

          estoqueCalculado = totalEntradas - totalSaidas;
        }

        return {
          ...p,
          tenant_name: p.tenant?.name || 'Unidade',
          estoque_atual: estoqueCalculado
        };
      }));

      setProducts(mappedProducts as any);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: "Erro ao carregar produtos",
        description: "Não foi possível carregar a lista de produtos.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    loadUnidadesMedida();
    // A carga inicial de produtos agora será feita pelo componente via loadProducts
  }, []);

  return {
    products,
    totalProducts,
    isSearching,
    currentPage,
    pageSize,
    unidadesMedida,
    loadProducts,
    loadUnidadesMedida
  };
};
