
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types';

interface ProductFormData {
  descricao: string;
  codigo: string;
  unidade_medida: string;
}

export function useProductMutations(onSuccess?: () => void) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase
        .from('produtos')
        .insert([{
          descricao: data.descricao,
          codigo: data.codigo,
          unidade_medida: data.unidade_medida,
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar produto:', error);
        
        // Verificar se é erro de duplicata de código
        if (error.code === '23505' && error.message.includes('produtos_codigo_unique')) {
          throw new Error('Produto já cadastrado');
        }
        
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      toast({
        title: "Produto cadastrado com sucesso!",
        description: "O produto foi adicionado ao sistema.",
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro na mutação:', error);
      
      let errorMessage = "Erro ao cadastrar produto";
      if (error.message === 'Produto já cadastrado') {
        errorMessage = "Produto já cadastrado";
      }
      
      toast({
        title: errorMessage,
        description: error.message === 'Produto já cadastrado' 
          ? "Um produto com este código já existe no sistema."
          : "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductFormData }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data: result, error } = await supabase
        .from('produtos')
        .update({
          descricao: data.descricao,
          codigo: data.codigo,
          unidade_medida: data.unidade_medida,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar produto:', error);
        
        // Verificar se é erro de duplicata de código
        if (error.code === '23505' && error.message.includes('produtos_codigo_unique')) {
          throw new Error('Produto já cadastrado');
        }
        
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      toast({
        title: "Produto atualizado com sucesso!",
        description: "As informações do produto foram atualizadas.",
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro na mutação:', error);
      
      let errorMessage = "Erro ao atualizar produto";
      if (error.message === 'Produto já cadastrado') {
        errorMessage = "Produto já cadastrado";
      }
      
      toast({
        title: errorMessage,
        description: error.message === 'Produto já cadastrado' 
          ? "Um produto com este código já existe no sistema."
          : "Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Produto excluído",
        description: "O produto foi removido do sistema.",
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      console.error('Erro ao excluir produto:', error);
      toast({
        title: "Erro ao excluir produto",
        description: "Não foi possível excluir o produto. Verifique se não há movimentações associadas.",
        variant: "destructive",
      });
    }
  });

  const submitForm = async (formData: ProductFormData, editingProduct: Product | null) => {
    setLoading(true);
    try {
      if (editingProduct) {
        await updateProductMutation.mutateAsync({ id: editingProduct.id, data: formData });
      } else {
        await createProductMutation.mutateAsync(formData);
      }
      return true;
    } catch (error) {
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id: string, descricao: string) => {
    if (user?.tipo !== 'ADMIN') {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem excluir produtos.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o produto ${descricao}?`)) return;

    deleteProductMutation.mutate(id);
  };

  return {
    loading,
    submitForm,
    deleteProduct,
    createProductMutation,
    updateProductMutation,
    deleteProductMutation
  };
}
