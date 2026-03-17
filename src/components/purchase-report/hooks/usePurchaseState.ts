
import { useState, useMemo, useCallback, useEffect } from 'react';
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
    estoqueMinimo: undefined,
    comReposicao: false
  });

  const persistence = usePurchaseDraftPersistence();

  const currentDraft = persistence.getCurrentDraft();
  const targetUnidadeId = currentDraft?.unidade_id;
  
  const { 
    produtos: initialProducts, 
    isLoading: isProductsLoading 
  } = usePurchaseData(targetUnidadeId);

  // Sincronizar purchaseItems com initialProducts (que tem o estoque da unidade correta)
  useEffect(() => {
    if (!isProductsLoading && initialProducts.length > 0) {
      setPurchaseItems(prevItems => {
        // Se já temos itens (possivelmente com quantidades de reposição), 
        // apenas atualizamos o estoque_atual vindo da unidade correta
        if (prevItems.length > 0) {
          console.log(`🔄 Atualizando estoque para unidade: ${targetUnidadeId || 'local'}`);
          return prevItems.map(item => {
            const updated = initialProducts.find(p => p.id === item.id);
            return updated ? { ...item, estoque_atual: updated.estoque_atual } : item;
          });
        }
        // Se está vazio (primeiro carregamento), inicializamos tudo
        console.log(`🆕 Inicializando produtos para unidade: ${targetUnidadeId || 'local'}`);
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
  }, []);

  const filteredItems = useMemo(() => {
    return purchaseItems.filter(item => {
      // Filtro por termo de busca
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          item.descricao.toLowerCase().includes(searchLower) ||
          item.codigo.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Filtro por estoque mínimo
      if (filters.estoqueMinimo !== undefined) {
        if (item.estoque_atual > filters.estoqueMinimo) return false;
      }

      // Filtro apenas com reposição - IGNORADO se houver busca por texto
      if (filters.comReposicao && !filters.searchTerm) {
        if (!item.quantidade_reposicao || item.quantidade_reposicao <= 0) return false;
      }

      return true;
    });
  }, [purchaseItems, filters]);

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

  const saveDraft = useCallback((nome: string) => {
    const draftItems: PurchaseDraftItem[] = purchaseItems.map(item => ({
      id: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade_medida: item.unidade_medida,
      estoque_atual: item.estoque_atual,
      quantidade_reposicao: item.quantidade_reposicao
    }));
    
    persistence.saveDraft(nome, draftItems);
    setLastSavedState(currentStateString);
  }, [purchaseItems, persistence.saveDraft, currentStateString]);

  const loadDraft = useCallback((draft: any) => {
    const loadedItems = persistence.loadDraft(draft);
    
    // IMPORTANTE: Ao carregar um rascunho, ignoramos o estoque_atual salvo no JSON
    // e mantemos o estoque_atual que já está no estado (calculado em tempo real pela unidade)
    setPurchaseItems(prevItems => {
      return prevItems.map(currentItem => {
        // Encontrar o item correspondente no rascunho carregado
        const draftItem = loadedItems.find(d => d.id === currentItem.id);
        
        if (draftItem) {
          // Mantemos os dados do rascunho (quantidade_reposicao), 
          // mas preservamos o estoque_atual real da unidade (currentItem.estoque_atual)
          return {
            ...currentItem,
            quantidade_reposicao: draftItem.quantidade_reposicao
          };
        }
        return currentItem;
      });
    });
    
    // Atualizar estado salvo para detecção de mudanças (usando o ID e a quantidade)
    const newStateString = JSON.stringify(
      loadedItems.map(item => ({ 
        id: item.id, 
        quantidade_reposicao: item.quantidade_reposicao 
      }))
    );
    setLastSavedState(newStateString);
    
    return loadedItems;
  }, [persistence.loadDraft]);

  // Auto-save a cada 30 segundos quando há mudanças
  useEffect(() => {
    // Auto-save when there are changes, with or without currentDraftId
    if (itemsForPDF.length === 0) return;

    const timer = setTimeout(() => {
      const draftItems: PurchaseDraftItem[] = purchaseItems.map(item => ({
        id: item.id,
        codigo: item.codigo,
        descricao: item.descricao,
        unidade_medida: item.unidade_medida,
        estoque_atual: item.estoque_atual,
        quantidade_reposicao: item.quantidade_reposicao
      }));
      
      persistence.autoSave(draftItems);
    }, 30000); // 30 segundos

    return () => clearTimeout(timer);
  }, [purchaseItems, persistence.autoSave, itemsForPDF.length]);

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
    setHasAttemptedAutoLoad(true); // Marca como carregado para evitar auto-load posterior
    const loadedItems = persistence.loadDraft(draft);
    persistence.createNewDraft(); // Reseta currentDraftId para nulo
    
    // Mesma lógica do loadDraft: preservar estoque real atual
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
    
    setLastSavedState(''); // Reseta para detectar mudanças
    return loadedItems;
  }, [persistence.loadDraft, persistence.createNewDraft]);

  const createNewDraft = useCallback(() => {
    setHasAttemptedAutoLoad(true); // Marca como carregado para evitar auto-load posterior
    persistence.createNewDraft();
    setPurchaseItems(items => items.map(item => ({
      ...item,
      quantidade_reposicao: undefined
    })));
    setLastSavedState('');
  }, [persistence.createNewDraft]);

  const loadDraftWrapper = useCallback((draft: any) => {
    setHasAttemptedAutoLoad(true); // Marca como carregado
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
    // Draft management
    ...persistence,
    createNewDraft,
    loadDraftAsBase,
    saveDraft,
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
