
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { PurchaseItem, PurchaseFilters } from '@/types/purchase';
import type { PurchaseDraftItem } from '@/types/purchase-draft';
import { usePurchaseDraftPersistence } from './usePurchaseDraftPersistence';

export function usePurchaseState() {
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [lastSavedState, setLastSavedState] = useState<string>('');
  const [filters, setFilters] = useState<PurchaseFilters>({
    searchTerm: '',
    estoqueMinimo: undefined,
    comReposicao: false
  });

  const persistence = usePurchaseDraftPersistence();

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

      // Filtro apenas com reposição
      if (filters.comReposicao) {
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
    const items = loadedItems.map(item => ({
      id: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade_medida: item.unidade_medida,
      estoque_atual: item.estoque_atual,
      quantidade_reposicao: item.quantidade_reposicao
    }));
    setPurchaseItems(items);
    
    // Atualizar estado salvo
    const newStateString = JSON.stringify(
      items.map(item => ({ 
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

  // Load latest draft on component mount
  useEffect(() => {
    if (persistence.drafts.length > 0 && !persistence.currentDraftId && purchaseItems.length > 0) {
      const latestDraft = persistence.drafts[0]; // Already sorted by data_atualizacao desc
      if (latestDraft.dados_produtos && latestDraft.dados_produtos.length > 0) {
        console.log('🔄 Carregando rascunho mais recente automaticamente:', latestDraft.nome_rascunho);
        loadDraft(latestDraft);
      }
    }
  }, [persistence.drafts, persistence.currentDraftId, purchaseItems.length, loadDraft]);

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
    saveDraft,
    loadDraft,
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
