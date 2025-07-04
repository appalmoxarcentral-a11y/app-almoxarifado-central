
import { useState, useMemo } from 'react';
import type { PurchaseItem, PurchaseFilters } from '@/types/purchase';

export function usePurchaseState() {
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [filters, setFilters] = useState<PurchaseFilters>({
    searchTerm: '',
    estoqueMinimo: undefined,
    comReposicao: false
  });

  const updatePurchaseQuantity = (productId: string, quantidade: number | undefined) => {
    setPurchaseItems(items => 
      items.map(item => 
        item.id === productId 
          ? { ...item, quantidade_reposicao: quantidade }
          : item
      )
    );
  };

  const initializePurchaseItems = (produtos: PurchaseItem[]) => {
    setPurchaseItems(produtos.map(produto => ({
      ...produto,
      quantidade_reposicao: undefined
    })));
  };

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

  return {
    purchaseItems,
    filteredItems,
    itemsForPDF,
    filters,
    setFilters,
    updatePurchaseQuantity,
    initializePurchaseItems
  };
}
