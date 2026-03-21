
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseItem, PurchaseFilters } from '@/types/purchase';
import type { PurchaseDraftItem } from '@/types/purchase-draft';
import { usePurchaseDraftPersistence } from './usePurchaseDraftPersistence';
import { usePurchaseData } from './usePurchaseData';

export function usePurchaseState() {
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [lastSavedState, setLastSavedState] = useState<string>('');
  const [hasAttemptedAutoLoad, setHasAttemptedAutoLoad] = useState(false);
  const [filters, setFilters] = useState<PurchaseFilters>({
    searchTerm: '',
    estoqueMinimo: undefined
  });

  const [sortTrigger, setSortTrigger] = useState(0);
  const [sortedIds, setSortedIds] = useState<string[]>([]);

  const [manualUnidadeId, setManualUnidadeId] = useState<string | null>(null);
  const persistence = usePurchaseDraftPersistence();

  const currentDraft = persistence.getCurrentDraft();
  const targetUnidadeId = manualUnidadeId || currentDraft?.unidade_id;

  // Buscar nome da unidade manual se necessário
  const { data: manualUnidadeNome } = useQuery({
    queryKey: ['unidade-manual-nome', manualUnidadeId],
    queryFn: async () => {
      if (!manualUnidadeId) return null;
      console.log('🔍 Buscando nome da unidade manual:', manualUnidadeId);
      const { data, error } = await supabase
        .from('unidades_saude')
        .select('nome')
        .eq('id', manualUnidadeId)
        .single();
      if (error) {
        console.error('❌ Erro ao buscar nome da unidade:', error);
        return null;
      }
      return data.nome;
    },
    enabled: !!manualUnidadeId
  });
  
  const { 
    produtos: initialProducts, 
    isLoading: isProductsLoading 
  } = usePurchaseData(targetUnidadeId);

  // Sincronizar purchaseItems com initialProducts
  useEffect(() => {
    if (!isProductsLoading && initialProducts.length > 0) {
      setPurchaseItems(prevItems => {
        if (prevItems.length > 0) {
          console.log(`🔄 Atualizando estoque para unidade: ${targetUnidadeId || 'local'}`);
          const updatedItems = prevItems.map(item => {
            const updated = initialProducts.find(p => p.id === item.id);
            return updated ? { ...item, estoque_atual: updated.estoque_atual } : item;
          });
          setSortTrigger(prev => prev + 1);
          return updatedItems;
        }
        console.log(`🆕 Inicializando produtos para unidade: ${targetUnidadeId || 'local'}`);
        setSortTrigger(prev => prev + 1);
        return initialProducts.map(p => ({ ...p, quantidade_reposicao: undefined }));
      });
    }
  }, [initialProducts, isProductsLoading, targetUnidadeId]);

  const updatePurchaseQuantity = useCallback((productId: string, quantidade: number | undefined) => {
    setPurchaseItems(items => 
      items.map(item => 
        item.id === productId 
          ? { ...item, quantidade_reposicao: quantidade }
          : item
      )
    );
  }, []);

  const initializePurchaseItems = useCallback((produtos: PurchaseItem[]) => {
    setPurchaseItems(produtos.map(produto => ({
      ...produto,
      quantidade_reposicao: undefined
    })));
    setSortTrigger(prev => prev + 1);
  }, []);

  // Atualiza a ordem dos IDs apenas quando necessário
  useEffect(() => {
    console.log('⚖️ Re-calculando ORDEM da lista de pedidos');
    const filtered = purchaseItems.filter(item => {
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        return item.descricao.toLowerCase().includes(searchLower) ||
               item.codigo.toLowerCase().includes(searchLower);
      }
      if (filters.estoqueMinimo !== undefined) {
        if (item.estoque_atual > filters.estoqueMinimo) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      // Hierarquia: Com Estoque (1) > Com Reposição (2) > Sem Estoque (3)
      const getTier = (item: PurchaseItem) => {
        if (item.estoque_atual > 0) return 1;
        if ((item.quantidade_reposicao || 0) > 0) return 2;
        return 3;
      };

      const tierA = getTier(a);
      const tierB = getTier(b);

      if (tierA !== tierB) return tierA - tierB;
      return a.descricao.localeCompare(b.descricao);
    });

    setSortedIds(sorted.map(item => item.id));
  }, [sortTrigger, filters.searchTerm, filters.estoqueMinimo, purchaseItems.length === 0]); 

  // Itens filtrados e ordenados mantendo a ordem estável durante a digitação
  const filteredItems = useMemo(() => {
    return sortedIds
      .map(id => purchaseItems.find(item => item.id === id))
      .filter(Boolean) as PurchaseItem[];
  }, [sortedIds, purchaseItems]);

  const itemsForPDF = useMemo(() => {
    return purchaseItems.filter(item => 
      item.quantidade_reposicao && item.quantidade_reposicao > 0
    );
  }, [purchaseItems]);

  // Detectar mudanças comparando estado atual com último salvo
  const currentStateString = JSON.stringify(
    purchaseItems.map(item => ({ 
      id: item.id, 
      quantidade_reposicao: item.quantidade_reposicao 
    }))
  );
  
  const hasChanges = currentStateString !== lastSavedState && persistence.currentDraftId !== null;

  const saveDraft = useCallback((nome: string, items?: PurchaseDraftItem[], unidade_id?: string) => {
    const finalItems = items || purchaseItems.map(item => ({
      id: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade_medida: item.unidade_medida,
      estoque_atual: item.estoque_atual,
      quantidade_reposicao: item.quantidade_reposicao
    }));
    
    const finalUnidadeId =  unidade_id || targetUnidadeId;
    
    persistence.saveDraft(nome, finalItems, finalUnidadeId || undefined);
    setLastSavedState(currentStateString);
    
    // Forçar re-ordenação APÓS salvar
    setSortTrigger(prev => prev + 1);
  }, [purchaseItems, persistence.saveDraft, currentStateString, targetUnidadeId]);

  const loadDraft = useCallback((draft: any) => {
    const loadedItems = persistence.loadDraft(draft);
    
    setPurchaseItems(prevItems => {
      return prevItems.map(currentItem => {
        const draftItem = loadedItems.find(d => d.id === currentItem.id);
        if (draftItem) {
          return {
            ...currentItem,
            quantidade_reposicao: draftItem.quantidade_reposicao
          };
        }
        return currentItem;
      });
    });
    
    const newStateString = JSON.stringify(
      loadedItems.map(item => ({ 
        id: item.id, 
        quantidade_reposicao: item.quantidade_reposicao 
      }))
    );
    setLastSavedState(newStateString);
    setSortTrigger(prev => prev + 1); // Re-ordena ao carregar
    
    return loadedItems;
  }, [persistence.loadDraft]);

  // REMOVIDO auto-save a cada 30 segundos conforme solicitado pelo usuário
  // "não salve ao digitar e sim ao clicar no botão salvar"

  // Carregar rascunho mais recente apenas na montagem inicial
  useEffect(() => {
    if (!hasAttemptedAutoLoad && persistence.drafts.length > 0 && !persistence.currentDraftId && purchaseItems.length > 0) {
      setHasAttemptedAutoLoad(true);
      const latestDraft = persistence.drafts[0]; // Já ordenado por data_atualizacao desc
      if (latestDraft.dados_produtos && latestDraft.dados_produtos.length > 0) {
        console.log('🔄 Carregando rascunho mais recente automaticamente:', latestDraft.nome_rascunho);
        loadDraft(latestDraft);
      }
    }
  }, [persistence.drafts, persistence.currentDraftId, purchaseItems.length, loadDraft, hasAttemptedAutoLoad]);

  const loadDraftAsBase = useCallback((draft: any) => {
    setHasAttemptedAutoLoad(true);
    const loadedItems = persistence.loadDraft(draft);
    persistence.createNewDraft();
    
    setPurchaseItems(prevItems => {
      return prevItems.map(currentItem => {
        const draftItem = loadedItems.find(d => d.id === currentItem.id);
        if (draftItem) {
          return {
            ...currentItem,
            quantidade_reposicao: draftItem.quantidade_reposicao
          };
        }
        return currentItem;
      });
    });
    
    setLastSavedState('');
    setSortTrigger(prev => prev + 1);
    return loadedItems;
  }, [persistence.loadDraft, persistence.createNewDraft]);

  const createNewDraft = useCallback(() => {
    setHasAttemptedAutoLoad(true);
    persistence.createNewDraft();
    setPurchaseItems(items => items.map(item => ({
      ...item,
      quantidade_reposicao: undefined
    })));
    setLastSavedState('');
    setSortTrigger(prev => prev + 1);
  }, [persistence.createNewDraft]);

  const setTargetUnidade = useCallback((unidadeId: string) => {
    setManualUnidadeId(unidadeId);
  }, []);

  const saveDraftWrapper = useCallback((nome: string, items: PurchaseDraftItem[], unidade_id?: string) => {
    saveDraft(nome, items, unidade_id);
  }, [saveDraft]);

  const loadDraftWrapper = useCallback((draft: any) => {
    setHasAttemptedAutoLoad(true); // Marca como carregado
    setManualUnidadeId(null); // Reseta unidade manual ao carregar rascunho existente
    return loadDraft(draft);
  }, [loadDraft]);

  return {
    purchaseItems,
    filteredItems,
    itemsForPDF,
    filters,
    setFilters,
    updatePurchaseQuantity,
    initializePurchaseItems,
    setTargetUnidade,
    targetUnidadeId,
    manualUnidadeNome,
    // Draft management
    ...persistence,
    createNewDraft,
    loadDraftAsBase,
    saveDraft: saveDraftWrapper,
    loadDraft: loadDraftWrapper,
    getCurrentDraft: useCallback(() => {
      const draft = persistence.getCurrentDraft();
      if (!draft) return undefined;
      
      return draft as any & { unidade_nome?: string; status: string; data_autorizacao?: string; data_entrega?: string };
    }, [persistence.getCurrentDraft]),
    authorizeDraft: persistence.authorizeDraft,
    confirmDelivery: persistence.confirmDelivery,
    draftItems: purchaseItems.map(item => ({
      id: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade_medida: item.unidade_medida,
      estoque_atual: item.estoque_atual,
      quantidade_reposicao: item.quantidade_reposicao
    })),
    hasChanges
  };
}
