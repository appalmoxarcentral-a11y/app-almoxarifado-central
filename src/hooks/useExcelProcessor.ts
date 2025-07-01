
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ExcelProductRow, ProcessResult } from '@/utils/excelUtils';

export const useExcelProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const processProductsFromExcel = async (data: ExcelProductRow[]): Promise<ProcessResult> => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    setIsProcessing(true);
    const errors: string[] = [];
    let processedCount = 0;

    try {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const lineNumber = i + 2;

        try {
          // Verificar se produto já existe
          const { data: existingProduct } = await supabase
            .from('produtos')
            .select('id')
            .eq('codigo', row.codigo)
            .single();

          if (!existingProduct) {
            // Criar novo produto
            const { error: productError } = await supabase
              .from('produtos')
              .insert({
                codigo: row.codigo,
                descricao: row.descricao,
                unidade_medida: row.unidade_medida as any,
                estoque_atual: 0
              });

            if (productError) {
              errors.push(`Linha ${lineNumber}: Erro ao criar produto - ${productError.message}`);
              continue;
            }
          }

          // Se tem quantidade, registrar entrada
          if (row.quantidade && row.quantidade > 0) {
            const { data: product } = await supabase
              .from('produtos')
              .select('id')
              .eq('codigo', row.codigo)
              .single();

            if (product) {
              const { error: entryError } = await supabase
                .from('entradas_produtos')
                .insert({
                  produto_id: product.id,
                  quantidade: row.quantidade,
                  lote: row.lote!,
                  vencimento: row.vencimento!,
                  data_entrada: row.data_entrada || new Date().toISOString().split('T')[0],
                  usuario_id: user.id
                });

              if (entryError) {
                errors.push(`Linha ${lineNumber}: Erro ao registrar entrada - ${entryError.message}`);
                continue;
              }
            }
          }

          processedCount++;
        } catch (error) {
          errors.push(`Linha ${lineNumber}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      }

      return {
        success: errors.length === 0,
        errors,
        processedCount,
        totalCount: data.length
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const processEntriesFromExcel = async (data: ExcelProductRow[]): Promise<ProcessResult> => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    setIsProcessing(true);
    const errors: string[] = [];
    let processedCount = 0;

    try {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const lineNumber = i + 2;

        if (!row.quantidade || row.quantidade <= 0) {
          errors.push(`Linha ${lineNumber}: Quantidade é obrigatória para entradas`);
          continue;
        }

        try {
          // Buscar produto pelo código
          const { data: product, error: productError } = await supabase
            .from('produtos')
            .select('id')
            .eq('codigo', row.codigo)
            .single();

          if (productError || !product) {
            errors.push(`Linha ${lineNumber}: Produto com código "${row.codigo}" não encontrado`);
            continue;
          }

          // Registrar entrada
          const { error: entryError } = await supabase
            .from('entradas_produtos')
            .insert({
              produto_id: product.id,
              quantidade: row.quantidade,
              lote: row.lote!,
              vencimento: row.vencimento!,
              data_entrada: row.data_entrada || new Date().toISOString().split('T')[0],
              usuario_id: user.id
            });

          if (entryError) {
            errors.push(`Linha ${lineNumber}: Erro ao registrar entrada - ${entryError.message}`);
            continue;
          }

          processedCount++;
        } catch (error) {
          errors.push(`Linha ${lineNumber}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
      }

      return {
        success: errors.length === 0,
        errors,
        processedCount,
        totalCount: data.length
      };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    processProductsFromExcel,
    processEntriesFromExcel,
    isProcessing
  };
};
