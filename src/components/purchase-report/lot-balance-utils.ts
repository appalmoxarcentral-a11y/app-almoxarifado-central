export interface LotEntryRecord {
  produto_id: string;
  lote: string;
  vencimento: string;
  quantidade: number;
}

export interface LotExitRecord {
  produto_id: string;
  lote: string;
  quantidade: number;
}

export interface LotBalanceInfo {
  lote: string;
  vencimento: string;
  quantidade: number;
}

export function normalizeLotLabel(lote: string) {
  return lote
    .replace(/\s+\(Almoxarifado Central\)$/i, '')
    .trim();
}

export function createLotLookupKey(produtoId: string, lote: string, vencimento: string) {
  return `${produtoId}::${normalizeLotLabel(lote)}::${vencimento}`;
}

export function buildLotBalancesByProduct(
  entries: LotEntryRecord[],
  exits: LotExitRecord[]
): Map<string, LotBalanceInfo[]> {
  const groupedByProduct = new Map<string, Map<string, LotBalanceInfo>>();

  for (const entry of entries) {
    const productMap = groupedByProduct.get(entry.produto_id) || new Map<string, LotBalanceInfo>();
    const normalizedLote = normalizeLotLabel(entry.lote);
    const lotKey = `${normalizedLote}::${entry.vencimento}`;
    const current = productMap.get(lotKey);

    productMap.set(lotKey, {
      lote: normalizedLote,
      vencimento: entry.vencimento,
      quantidade: (current?.quantidade || 0) + entry.quantidade
    });

    groupedByProduct.set(entry.produto_id, productMap);
  }

  for (const exit of exits) {
    const productMap = groupedByProduct.get(exit.produto_id);
    if (!productMap) continue;

    let remainingToSubtract = exit.quantidade;
    const normalizedLote = normalizeLotLabel(exit.lote);
    const matchingLots = Array.from(productMap.values())
      .filter(lot => lot.lote === normalizedLote)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

    for (const lot of matchingLots) {
      if (remainingToSubtract <= 0) break;
      const usedAmount = Math.min(lot.quantidade, remainingToSubtract);
      lot.quantidade -= usedAmount;
      remainingToSubtract -= usedAmount;
    }
  }

  const result = new Map<string, LotBalanceInfo[]>();

  for (const [productId, productMap] of groupedByProduct.entries()) {
    result.set(
      productId,
      Array.from(productMap.values())
        .filter(lot => lot.quantidade > 0)
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.lote.localeCompare(b.lote, 'pt-BR', { sensitivity: 'base' }))
    );
  }

  return result;
}

export function buildLotBalanceLookup(entries: LotEntryRecord[], exits: LotExitRecord[]) {
  const balancesByProduct = buildLotBalancesByProduct(entries, exits);
  const lookup = new Map<string, number>();

  for (const [productId, lots] of balancesByProduct.entries()) {
    for (const lot of lots) {
      lookup.set(createLotLookupKey(productId, lot.lote, lot.vencimento), lot.quantidade);
    }
  }

  return lookup;
}
