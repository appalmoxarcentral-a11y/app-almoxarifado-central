
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
  const [lastAutoSavedState, setLastAutoSavedState] = useState<string>('');
  const [lastSavedItems, setLastSavedItems] = useState<PurchaseDraftItem[]>([]);
  const [hasAttemptedAutoLoad, setHasAttemptedAutoLoad] = useState(false);
  const [filters, setFilters] = useState<PurchaseFilters>({
    searchTerm: '',
    searchType: 'todos',
    estoqueMinimo: undefined,
    sortColumn: 'none',
    sortDirection: 'asc'
  });

  const [sortTrigger, setSortTrigger] = useState(0);

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

  const cloneDraftItems = useCallback((items: PurchaseDraftItem[]) => {
    return items.map(item => ({
      ...item,
      lotes_multiplos: item.lotes_multiplos?.map(lote => ({ ...lote }))
    }));
  }, []);

  const buildDraftItems = useCallback((items: Array<PurchaseItem | PurchaseDraftItem>) => {
    return items.map(item => ({
      id: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade_medida: item.unidade_medida,
      estoque_atual: item.estoque_atual,
      prioridade: item.prioridade,
      quantidade_reposicao: item.quantidade_reposicao,
      anotacao_reposicao: item.anotacao_reposicao,
      lote_selecionado: item.lote_selecionado,
      vencimento_selecionado: item.vencimento_selecionado,
      lotes_multiplos: item.lotes_multiplos?.map(lote => ({ ...lote }))
    }));
  }, []);

  const serializeComparableItem = useCallback((item: Pick<PurchaseDraftItem, 'quantidade_reposicao' | 'lote_selecionado' | 'vencimento_selecionado' | 'lotes_multiplos'>) => {
    const normalizedLotes = [...(item.lotes_multiplos || [])]
      .map(lote => ({
        lote: lote.lote,
        vencimento: lote.vencimento,
        quantidade: lote.quantidade
      }))
      .sort((a, b) =>
        a.lote.localeCompare(b.lote, 'pt-BR', { sensitivity: 'base' }) ||
        a.vencimento.localeCompare(b.vencimento) ||
        a.quantidade - b.quantidade
      );

    return JSON.stringify({
      q: item.quantidade_reposicao || 0,
      anotacao: 'anotacao_reposicao' in item ? (item as PurchaseDraftItem).anotacao_reposicao?.trim() || null : null,
      lote: item.lote_selecionado || null,
      vencimento: item.vencimento_selecionado || null,
      lotes: normalizedLotes
    });
  }, []);

  const serializeDraftState = useCallback((items: Array<Pick<PurchaseDraftItem, 'id' | 'quantidade_reposicao' | 'lote_selecionado' | 'vencimento_selecionado' | 'lotes_multiplos'>>) => {
    return JSON.stringify(
      items
        .filter(item => (item.quantidade_reposicao || 0) > 0)
        .map(item => ({
          id: item.id,
          comparable: serializeComparableItem(item)
        }))
    );
  }, [serializeComparableItem]);

  const syncLocalItemsFromDraft = useCallback((updatedDraftItems: PurchaseDraftItem[]) => {
    setPurchaseItems(prev => prev.map(localItem => {
      const updatedItem = updatedDraftItems.find(i => i.id === localItem.id);
      if (!updatedItem) return localItem;

      return {
        ...localItem,
        quantidade_reposicao: updatedItem.quantidade_reposicao,
        anotacao_reposicao: updatedItem.anotacao_reposicao,
        lote_selecionado: updatedItem.lote_selecionado,
        vencimento_selecionado: updatedItem.vencimento_selecionado,
        lotes_multiplos: updatedItem.lotes_multiplos
      };
    }));
  }, []);

  const getChangedItemsSinceLastSave = useCallback((items: PurchaseDraftItem[]) => {
    const lastSavedMap = new Map(
      lastSavedItems.map(item => [item.id, serializeComparableItem(item)])
    );

    return items.filter(item => {
      if ((item.quantidade_reposicao || 0) <= 0) return false;

      const currentComparable = serializeComparableItem(item);
      const savedComparable = lastSavedMap.get(item.id);

      return currentComparable !== savedComparable;
    });
  }, [lastSavedItems, serializeComparableItem]);

  // Sincronizar purchaseItems com initialProducts
  useEffect(() => {
    if (!isProductsLoading && initialProducts.length > 0) {
      setPurchaseItems(prevItems => {
        if (prevItems.length > 0) {
          console.log(`🔄 Atualizando estoque para unidade: ${targetUnidadeId || 'local'}`);
          const updatedItems = prevItems.map(item => {
            const updated = initialProducts.find(p => p.id === item.id);
            return updated ? {
              ...item,
              estoque_atual: updated.estoque_atual,
              estoque_origem: updated.estoque_origem,
              prioridade: updated.prioridade
            } : item;
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
              if (newLotes[lotIndex].quantidade === (quantidade || 0)) {
                return item;
              }
              newLotes[lotIndex] = { ...newLotes[lotIndex], quantidade: quantidade || 0 };
            }
            // Recalcula o total de reposição baseado na soma dos lotes
            const newTotal = newLotes.reduce((sum, l) => sum + l.quantidade, 0);
            if (item.quantidade_reposicao === newTotal) {
              return item;
            }
            return {
              ...item,
              quantidade_reposicao: newTotal,
              lotes_multiplos: newLotes
            };
          }
          // Atualização normal (não fracionada ou inicial)
          if (item.quantidade_reposicao === quantidade) {
            return item;
          }
          return { 
            ...item, 
            quantidade_reposicao: quantidade 
          };
        }
        return item;
      })
    );
  }, []);

  const updatePurchaseAnnotation = useCallback((productId: string, anotacao: string | undefined) => {
    setPurchaseItems(items =>
      items.map(item =>
        item.id === productId
          ? { ...item, anotacao_reposicao: anotacao?.trim() ? anotacao.trim() : undefined }
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

  const filteredItems = useMemo(() => {
    console.log('⚖️ Re-calculando ORDEM da lista de pedidos');

    const matchesUnitFilter = (unidadeMedida?: string, rawSearch?: string) => {
      if (!unidadeMedida || !rawSearch) return false;

      const normalizedUnit = unidadeMedida.toLowerCase().trim();
      const terms = rawSearch
        .split(/[,\n;|]+/)
        .map(term => term.trim().toLowerCase())
        .filter(Boolean);

      if (terms.length === 0) {
        return normalizedUnit === rawSearch.toLowerCase().trim();
      }

      return terms.some(term => normalizedUnit === term);
    };

    const savedItemsMap = new Map(lastSavedItems.map(item => [item.id, item]));

    const getSavedQuantityForOrdering = (item: PurchaseItem) => {
      return savedItemsMap.get(item.id)?.quantidade_reposicao ?? 0;
    };

    const getPriorityCycleBucket = (item: PurchaseItem) => {
      const reposicao = getSavedQuantityForOrdering(item);
      const destino = item.estoque_atual ?? 0;
      const origem = item.estoque_origem ?? 0;

      if (reposicao > 0) return 0;
      if (destino > 0) return 1;
      if (origem > 0) return 2;
      if (reposicao === 0) return 3;
      if (destino === 0) return 4;
      if (origem === 0) return 5;
      if (reposicao < 0) return 6;
      if (destino < 0) return 7;
      return 8;
    };

    const filtered = purchaseItems.filter(item => {
      if (filters.sortColumn === 'anotacoes' && !item.anotacao_reposicao?.trim()) {
        return false;
      }

      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const type = filters.searchType || 'todos';

        if (type === 'codigo') {
          return item.codigo.toLowerCase().includes(searchLower);
        }
        if (type === 'descricao') {
          return item.descricao.toLowerCase().includes(searchLower);
        }
        if (type === 'unidade') {
          return matchesUnitFilter(item.unidade_medida, filters.searchTerm);
        }

        return item.descricao.toLowerCase().includes(searchLower) ||
               item.codigo.toLowerCase().includes(searchLower) ||
               (item.unidade_medida && item.unidade_medida.toLowerCase().includes(searchLower));
      }

      if (filters.estoqueMinimo !== undefined) {
        if (item.estoque_atual > filters.estoqueMinimo) return false;
      }

      return true;
    });

    const businessSorted = [...filtered].sort((a, b) => {
      const aPrioridade = a.prioridade ?? 0;
      const bPrioridade = b.prioridade ?? 0;
      const aIsPriority = aPrioridade >= 1 && aPrioridade <= 3;
      const bIsPriority = bPrioridade >= 1 && bPrioridade <= 3;

      const aBucket = getPriorityCycleBucket(a);
      const bBucket = getPriorityCycleBucket(b);

      // Primeiro aplicar o ciclo de exibicao para toda a lista.
      if (aBucket !== bBucket) {
        return aBucket - bBucket;
      }

      // Dentro da mesma etapa do ciclo, itens com prioridade 1-3 sobem.
      if (aIsPriority !== bIsPriority) {
        return aIsPriority ? -1 : 1;
      }

      // Se ambos forem prioritarios, respeitar 1 -> 2 -> 3.
      if (aIsPriority && bIsPriority && aPrioridade !== bPrioridade) {
        return aPrioridade - bPrioridade;
      }

      return a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' });
    });

    if (!filters.sortColumn || filters.sortColumn === 'none' || filters.sortColumn === 'anotacoes') {
      return businessSorted;
    }

    const directionMultiplier = filters.sortDirection === 'desc' ? -1 : 1;

    const getSortValue = (item: PurchaseItem) => {
      switch (filters.sortColumn) {
        case 'unidade_medida':
          return item.unidade_medida ?? '';
        case 'estoque_origem':
          return item.estoque_origem ?? 0;
        case 'estoque_atual':
          return item.estoque_atual ?? 0;
        case 'quantidade_reposicao':
          return item.quantidade_reposicao ?? 0;
        default:
          return '';
      }
    };

    return [...businessSorted].sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const stringComparison = aValue.localeCompare(bValue, 'pt-BR', { sensitivity: 'base' });
        if (stringComparison !== 0) return stringComparison * directionMultiplier;
      } else {
        const numberComparison = Number(aValue) - Number(bValue);
        if (numberComparison !== 0) return numberComparison * directionMultiplier;
      }

      return a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' });
    });
  }, [sortTrigger, purchaseItems, filters.searchTerm, filters.searchType, filters.estoqueMinimo, filters.sortColumn, filters.sortDirection, lastSavedItems]);

  const itemsForPDF = useMemo(() => {
    return purchaseItems.filter(item => 
      item.quantidade_reposicao && item.quantidade_reposicao > 0
    );
  }, [purchaseItems]);

  const draftItemsSnapshot = useMemo(() => buildDraftItems(purchaseItems), [buildDraftItems, purchaseItems]);

  // Detectar mudanças comparando estado atual com último salvo
  const currentStateString = useMemo(() => JSON.stringify(
    purchaseItems
      .filter(item => (item.quantidade_reposicao || 0) > 0)
      .map(item => ({
        id: item.id,
        q: item.quantidade_reposicao || 0,
        anotacao: item.anotacao_reposicao?.trim() || null,
        lote: item.lote_selecionado || null,
        vencimento: item.vencimento_selecionado || null,
        lotes: (item.lotes_multiplos || []).map(lote => ({
          lote: lote.lote,
          vencimento: lote.vencimento,
          quantidade: lote.quantidade
        }))
      }))
  ), [purchaseItems]);
  
  const hasChanges = currentStateString !== lastSavedState && persistence.currentDraftId !== null;

  useEffect(() => {
    const currentDraft = persistence.getCurrentDraft();
    const canAutoPersist =
      hasAttemptedAutoLoad &&
      !!persistence.currentDraftId &&
      !!currentDraft?.nome_rascunho &&
      currentDraft?.status !== 'autorizado' &&
      currentDraft?.status !== 'entregue';

    if (!canAutoPersist || persistence.isSaving) {
      return;
    }

    if (currentStateString === lastAutoSavedState) {
      return;
    }

    persistence.saveDraft(
      currentDraft.nome_rascunho,
      draftItemsSnapshot,
      targetUnidadeId || undefined,
      () => {
        setLastAutoSavedState(currentStateString);
      }
    );
  }, [
    currentStateString,
    draftItemsSnapshot,
    hasAttemptedAutoLoad,
    lastAutoSavedState,
    persistence,
    targetUnidadeId
  ]);

  const saveDraft = useCallback((nome: string, items?: PurchaseDraftItem[], unidade_id?: string) => {
    if (persistence.isSaving) return;

    // 1. Determinar quais itens usar
    const itemsToUse = items || draftItemsSnapshot;

    const finalUnidadeId = unidade_id || targetUnidadeId;

    // Sincroniza imediatamente os itens vindos do modal para evitar reabrir com dados antigos.
    if (items) {
      syncLocalItemsFromDraft(items);
      setSortTrigger(prev => prev + 1);
    }
    
    // 2. Chamar persistência com callback de sucesso
    persistence.saveDraft(nome, itemsToUse, finalUnidadeId || undefined, (savedData) => {
      // Sincronizar estado local apenas após sucesso real no banco
      const savedStateString = serializeDraftState(itemsToUse);
      setLastSavedState(savedStateString);
      setLastAutoSavedState(savedStateString);
      setLastSavedItems(cloneDraftItems(itemsToUse));
      
      // Se itens foram passados externamente (do modal de lotes), atualizar estado local
      if (items) {
        syncLocalItemsFromDraft(items);
      }

      // Forçar re-ordenação APÓS salvar
      setSortTrigger(prev => prev + 1);
    });
  }, [draftItemsSnapshot, persistence.saveDraft, persistence.isSaving, targetUnidadeId, serializeDraftState, syncLocalItemsFromDraft, cloneDraftItems]);

  const loadDraft = useCallback((draft: any) => {
    const loadedItems = persistence.loadDraft(draft);
    
    setPurchaseItems(prevItems => {
      return prevItems.map(currentItem => {
        const draftItem = loadedItems.find(d => d.id === currentItem.id);
        if (draftItem) {
          return {
            ...currentItem,
            quantidade_reposicao: draftItem.quantidade_reposicao,
            anotacao_reposicao: draftItem.anotacao_reposicao,
            lote_selecionado: draftItem.lote_selecionado,
            vencimento_selecionado: draftItem.vencimento_selecionado,
            lotes_multiplos: draftItem.lotes_multiplos
          };
        }
        return currentItem;
      });
    });
    
    const newStateString = serializeDraftState(loadedItems);
    setLastSavedState(newStateString);
    setLastAutoSavedState(newStateString);
    setLastSavedItems(cloneDraftItems(loadedItems));
    setSortTrigger(prev => prev + 1); // Re-ordena ao carregar
    
    return loadedItems;
  }, [persistence.loadDraft, serializeDraftState, cloneDraftItems]);

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
            anotacao_reposicao: draftItem.anotacao_reposicao,
            lote_selecionado: draftItem.lote_selecionado,
            vencimento_selecionado: draftItem.vencimento_selecionado,
            lotes_multiplos: draftItem.lotes_multiplos
          };
        }
        return currentItem;
      });
    });
    
    setLastSavedState('');
    setLastAutoSavedState('');
    setLastSavedItems([]);
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
    setLastAutoSavedState('');
    setLastSavedItems([]);
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
    updatePurchaseAnnotation,
    initializePurchaseItems,
    setTargetUnidade,
    targetUnidadeId,
    manualUnidadeId,
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
    draftItems: draftItemsSnapshot,
    hasChanges,
    getChangedItemsSinceLastSave
  };
}
