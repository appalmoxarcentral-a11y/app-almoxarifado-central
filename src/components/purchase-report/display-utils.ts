import type { PurchaseItem } from '@/types/purchase';
import type { PurchaseDraftItem } from '@/types/purchase-draft';

type PurchaseDisplayBase = Pick<
  PurchaseItem,
  'id' | 'estoque_atual' | 'estoque_origem' | 'lotes_multiplos' | 'lote_selecionado' | 'vencimento_selecionado' | 'quantidade_reposicao'
>;

export function getValidLotsForDisplay(item: PurchaseDisplayBase) {
  return (item.lotes_multiplos || []).filter(lote =>
    Boolean(lote.lote) && Boolean(lote.vencimento) && lote.quantidade > 0
  );
}

export function countDisplayLines<T extends PurchaseDisplayBase>(items: T[]) {
  return items.reduce((total, item) => {
    const validLots = getValidLotsForDisplay(item);
    if (validLots.length > 1) {
      return total + validLots.length;
    }
    return total + ((item.quantidade_reposicao || 0) > 0 ? 1 : 0);
  }, 0);
}

export function expandItemsForDisplay<T extends PurchaseItem | PurchaseDraftItem>(items: T[]) {
  const expanded: Array<T & { originalId?: string; isMultiLot?: boolean; lotIndex?: number }> = [];

  items.forEach(item => {
    const validLots = getValidLotsForDisplay(item);

    if (validLots.length > 1) {
      validLots.forEach((lote, idx) => {
        expanded.push({
          ...item,
          id: `${item.id}-lote-${idx}`,
          originalId: item.id,
          estoque_atual: lote.saldo_destino_lote ?? item.estoque_atual,
          estoque_origem: lote.saldo_origem_lote ?? item.estoque_origem,
          lotes_multiplos: undefined,
          lote_selecionado: lote.lote,
          vencimento_selecionado: lote.vencimento,
          quantidade_reposicao: lote.quantidade,
          isMultiLot: true,
          lotIndex: idx
        } as T & { originalId?: string; isMultiLot?: boolean; lotIndex?: number });
      });
      return;
    }

    expanded.push(item);
  });

  return expanded;
}
