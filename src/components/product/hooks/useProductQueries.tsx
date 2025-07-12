
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
