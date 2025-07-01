
import { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UnidadeMedida, Product } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface FormData {
  descricao: string;
  codigo: string;
  unidade_medida: UnidadeMedida;
}

export const useProductMutations = (onSuccess: () => void) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const createProduct = async (formData: FormData) => {
    const { error } = await supabase
      .from('produtos')
      .insert([{
        descricao: formData.descricao,
        codigo: formData.codigo.toUpperCase(),
        unidade_medida: formData.unidade_medida,
        estoque_atual: 0
      }]);

    if (error) throw error;
    
    toast({
      title: "Produto cadastrado com sucesso!",
      description: `${formData.descricao} foi adicionado ao sistema.`,
    });
  };

  const updateProduct = async (productId: string, formData: FormData) => {
    const { error } = await supabase
      .from('produtos')
      .update({
        descricao: formData.descricao,
        codigo: formData.codigo.toUpperCase(),
        unidade_medida: formData.unidade_medida,
      })
      .eq('id', productId);

    if (error) throw error;
    
    toast({
      title: "Produto atualizado com sucesso!",
      description: `${formData.descricao} foi atualizado no sistema.`,
    });
  };

  const deleteProduct = async (id: string, descricao: string) => {
    if (user?.tipo !== 'ADMIN') {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem excluir produtos. Entre em contato com o administrador do sistema.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o produto ${descricao}?`)) return;

    try {
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Produto excluído",
        description: `${descricao} foi removido do sistema.`,
      });

      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao excluir produto",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const submitForm = async (formData: FormData, editingProduct: Product | null) => {
    setLoading(true);
    
    try {
      if (!formData.descricao || !formData.codigo || !formData.unidade_medida) {
        throw new Error('Todos os campos são obrigatórios');
      }

      if (editingProduct) {
        await updateProduct(editingProduct.id, formData);
      } else {
        await createProduct(formData);
      }
      
      onSuccess();
      return true;
      
    } catch (error) {
      toast({
        title: editingProduct ? "Erro ao atualizar produto" : "Erro ao cadastrar produto",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    submitForm,
    deleteProduct
  };
};
