
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types";
import { useToast } from "@/hooks/use-toast";

export const useProductQueries = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
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
        label: `${unidade.descricao}`
      }));
      
      setUnidadesMedida(unidades);
    } catch (error) {
      console.error('Erro ao carregar unidades de medida:', error);
      // Fallback para unidades padrão em caso de erro
      setUnidadesMedida([
        { value: 'AM', label: 'Ampola (AM)' },
        { value: 'CP', label: 'Comprimido (CP)' },
        { value: 'BG', label: 'Bisnaga (BG)' },
        { value: 'FR', label: 'Frasco (FR)' },
        { value: 'CPS', label: 'Cápsula (CPS)' },
        { value: 'ML', label: 'Mililitro (ML)' },
        { value: 'MG', label: 'Miligrama (MG)' },
        { value: 'G', label: 'Grama (G)' },
        { value: 'KG', label: 'Quilograma (KG)' },
        { value: 'UN', label: 'Unidade (UN)' },
      ]);
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: "Erro ao carregar produtos",
        description: "Não foi possível carregar a lista de produtos.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadProducts();
    loadUnidadesMedida();
  }, []);

  return {
    products,
    unidadesMedida,
    loadProducts,
    loadUnidadesMedida
  };
};
