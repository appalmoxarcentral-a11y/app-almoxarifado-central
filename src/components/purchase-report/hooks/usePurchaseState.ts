
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
    refetchOnWindowFocus: false,
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

  const updatePurchaseQuantity = useCallback((productId: string, quantidade: number | undefined, lotIndex?: number) => {
    setPurchaseItems(items => 
      items.map(item => {
        if (item.id === productId) {
          // Se for uma atualização de um lote específico (fracionado)
          if (lotIndex !== undefined && item.lotes_multiplos) {
            const newLotes = [...item.lotes_multiplos];
            if (newLotes[lotIndex]) {
              newLotes[lotIndex] = { ...newLotes[lotIndex], quantidade: quantidade || 0 };
            }
            // Recalcula o total de reposição baseado na soma dos lotes
            const newTotal = newLotes.reduce((sum, l) => sum + l.quantidade, 0);
            return {
              ...item,
              quantidade_reposicao: newTotal,
              lotes_multiplos: newLotes
            };
          }
          // Atualização normal (não fracionada ou inicial)
          return { 
            ...item, 
            quantidade_reposicao: quantidade 
          };
        }
        return item;
      })
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
  const currentStateString = useMemo(() => JSON.stringify(
    purchaseItems.map(item => ({ 
      id: item.id, 
      q: item.quantidade_reposicao 
    }))
  ), [purchaseItems]);
  
  const hasChanges = currentStateString !== lastSavedState && persistence.currentDraftId !== null;

  const saveDraft = useCallback((nome: string, items?: PurchaseDraftItem[], unidade_id?: string) => {
    if (persistence.isSaving) return;

    // 1. Determinar quais itens usar
    const itemsToUse = items || purchaseItems.map(item => ({
      id: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade_medida: item.unidade_medida,
      estoque_atual: item.estoque_atual,
      quantidade_reposicao: item.quantidade_reposicao,
      lote_selecionado: item.lote_selecionado,
      vencimento_selecionado: item.vencimento_selecionado,
      lotes_multiplos: item.lotes_multiplos
    }));

    const finalUnidadeId = unidade_id || targetUnidadeId;
    
    // 2. Chamar persistência com callback de sucesso
    persistence.saveDraft(nome, itemsToUse, finalUnidadeId || undefined, (savedData) => {
      // Sincronizar estado local apenas após sucesso real no banco
      const savedStateString = JSON.stringify(itemsToUse.map(i => ({ id: i.id, q: i.quantidade_reposicao })));
      setLastSavedState(savedStateString);
      
      // Se itens foram passados externamente (do modal de lotes), atualizar estado local
      if (items) {
        setPurchaseItems(prev => prev.map(localItem => {
          const updatedItem = items.find(i => i.id === localItem.id);
          if (updatedItem) {
            return {
              ...localItem,
              lote_selecionado: updatedItem.lote_selecionado,
              vencimento_selecionado: updatedItem.vencimento_selecionado,
              quantidade_reposicao: updatedItem.quantidade_reposicao
            };
          }
          return localItem;
        }));
      }

      // Forçar re-ordenação APÓS salvar
      setSortTrigger(prev => prev + 1);
    });
  }, [purchaseItems, persistence.saveDraft, persistence.isSaving, targetUnidadeId]);

  const loadDraft = useCallback((draft: any) => {
    const loadedItems = persistence.loadDraft(draft);
    
    setPurchaseItems(prevItems => {
      return prevItems.map(currentItem => {
        const draftItem = loadedItems.find(d => d.id === currentItem.id);
        if (draftItem) {
          return {
            ...currentItem,
            quantidade_reposicao: draftItem.quantidade_reposicao,
            lote_selecionado: draftItem.lote_selecionado,
            vencimento_selecionado: draftItem.vencimento_selecionado,
            lotes_multiplos: draftItem.lotes_multiplos
          };
        }
        return currentItem;
      });
    });
    
    const newStateString = JSON.stringify(
      loadedItems.map(item => ({ 
        id: item.id, 
        q: item.quantidade_reposicao 
      }))
    );
    setLastSavedState(newStateString);
    setSortTrigger(prev => prev + 1); // Re-ordena ao carregar
    
    return loadedItems;
  }, [persistence.loadDraft]);

  // REMOVIDO auto-save a cada 30 segundos conforme solicitado pelo usuário
  // "não salve ao digitar e sim ao clicar no botão salvar"

  // Carregar rascunho persistido ou o mais recente apenas na montagem inicial
  useEffect(() => {
    if (!hasAttemptedAutoLoad && persistence.drafts.length > 0 && purchaseItems.length > 0) {
      setHasAttemptedAutoLoad(true);
      
      // 1. Tentar carregar o rascunho que estava sendo trabalhado (via persistence.currentDraftId do localStorage)
      const lastDraft = persistence.drafts.find(d => d.id === persistence.currentDraftId);
      
      if (lastDraft) {
        console.log('🔄 Restaurando último rascunho trabalhado:', lastDraft.nome_rascunho);
        loadDraft(lastDraft);
      } 
      // 2. Se não houver rascunho selecionado, carregar o mais recente por padrão
      else if (!persistence.currentDraftId) {
        const latestDraft = persistence.drafts[0]; // Já ordenado por data_atualizacao desc
        if (latestDraft.dados_produtos && latestDraft.dados_produtos.length > 0) {
          console.log('🔄 Carregando rascunho mais recente automaticamente:', latestDraft.nome_rascunho);
          loadDraft(latestDraft);
        }
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
            quantidade_reposicao: draftItem.quantidade_reposicao,
            lote_selecionado: draftItem.lote_selecionado,
            vencimento_selecionado: draftItem.vencimento_selecionado,
            lotes_multiplos: draftItem.lotes_multiplos
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

  const saveDraftWrapper = useCallback((nome: string, items: PurchaseDraftItem[], unidade_id?: string, onSuccess?: (data: any) => void) => {
    saveDraft(nome, items, unidade_id);
    if (onSuccess) {
      // Como o saveDraft interno agora lida com o callback de persistência,
      // essa wrapper pode precisar de ajuste se quisermos expor o callback externo.
      // Mas para o DraftManager, ele não passa callback.
    }
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
    stockError: persistence.stockError,
    clearStockError: persistence.clearStockError,
    draftItems: purchaseItems.map(item => ({
      id: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade_medida: item.unidade_medida,
      estoque_atual: item.estoque_atual,
      quantidade_reposicao: item.quantidade_reposicao,
      lote_selecionado: item.lote_selecionado,
      vencimento_selecionado: item.vencimento_selecionado,
      lotes_multiplos: item.lotes_multiplos
    })),
    hasChanges
  };
}
