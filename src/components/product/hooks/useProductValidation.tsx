import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';

interface UseProductValidationProps {
  codigo: string;
  editingProductId?: string;
}

export function useProductValidation({ codigo, editingProductId }: UseProductValidationProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [suggestedCodes, setSuggestedCodes] = useState<string[]>([]);
  
  const debouncedCodigo = useDebounce(codigo, 500);

  useEffect(() => {
    if (!debouncedCodigo || debouncedCodigo.length < 3) {
      setIsDuplicate(false);
      setSuggestedCodes([]);
      return;
    }

    validateCodigo(debouncedCodigo);
  }, [debouncedCodigo, editingProductId]);

  const validateCodigo = async (codigoToValidate: string) => {
    setIsValidating(true);
    try {
      // Verificar se já existe
      let query = supabase
        .from('produtos')
        .select('codigo, id')
        .eq('codigo', codigoToValidate);

      // Se estamos editando, excluir o produto atual da busca
      if (editingProductId) {
        query = query.neq('id', editingProductId);
      }

      const { data: existingProduct } = await query.single();
      
      if (existingProduct) {
        setIsDuplicate(true);
        // Gerar sugestões de códigos alternativos
        await generateSuggestedCodes(codigoToValidate);
      } else {
        setIsDuplicate(false);
        setSuggestedCodes([]);
      }
    } catch (error) {
      // Se não encontrou, não é duplicata
      setIsDuplicate(false);
      setSuggestedCodes([]);
    } finally {
      setIsValidating(false);
    }
  };

  const generateSuggestedCodes = async (baseCodigo: string) => {
    const suggestions: string[] = [];
    
    // Buscar códigos similares para encontrar um padrão
    const { data: similarCodes } = await supabase
      .from('produtos')
      .select('codigo')
      .ilike('codigo', `${baseCodigo}%`)
      .order('codigo');

    // Gerar sugestões baseadas em números sequenciais
    for (let i = 1; i <= 5; i++) {
      const suggestion = `${baseCodigo}${i.toString().padStart(2, '0')}`;
      if (!similarCodes?.some(p => p.codigo === suggestion)) {
        suggestions.push(suggestion);
      }
    }

    // Se o código termina com número, incrementar
    const match = baseCodigo.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2]);
      
      for (let i = 1; i <= 3; i++) {
        const suggestion = `${prefix}${(num + i).toString().padStart(match[2].length, '0')}`;
        if (!similarCodes?.some(p => p.codigo === suggestion) && !suggestions.includes(suggestion)) {
          suggestions.push(suggestion);
        }
      }
    }

    setSuggestedCodes(suggestions.slice(0, 3));
  };

  return {
    isValidating,
    isDuplicate,
    suggestedCodes,
    validateCodigo: () => validateCodigo(codigo)
  };
}