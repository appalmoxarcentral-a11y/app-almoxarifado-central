
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Package, Hash, Layers } from 'lucide-react';
import type { PurchaseItem } from '@/types/purchase';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PurchaseTableProps {
  items: PurchaseItem[];
  onQuantityChange: (productId: string, quantity: number | undefined) => void;
  unidadeDestinoNome?: string;
  isCentralUnit?: boolean;
}

export function PurchaseTable({ items, onQuantityChange, unidadeDestinoNome, isCentralUnit }: PurchaseTableProps) {
  const isMobile = useIsMobile();

  // "Explodir" itens que possuem múltiplos lotes para exibição individual
  const displayedItems = React.useMemo(() => {
    const flattened: (PurchaseItem & { isMultiLot?: boolean; lotIndex?: number })[] = [];
    
    items.forEach(item => {
      if (item.lotes_multiplos && item.lotes_multiplos.length > 1) {
        item.lotes_multiplos.forEach((lote, idx) => {
          flattened.push({
            ...item,
            id: `${item.id}-lote-${idx}`, // ID único para a linha da tabela
            originalId: item.id, // Referência para ações
            lote_selecionado: lote.lote,
            vencimento_selecionado: lote.vencimento,
            quantidade_reposicao: lote.quantidade,
            isMultiLot: true,
            lotIndex: idx
          } as any);
        });
      } else {
        flattened.push(item);
      }
    });
    
    return flattened;
  }, [items]);

  const handleQuantityChange = (productId: string, value: string, originalId?: string, lotIndex?: number) => {
    const quantity = value === '' ? undefined : parseInt(value);
    if (quantity !== undefined && quantity < 0) return;
    
    // Se for um item fracionado, precisamos atualizar especificamente aquele lote no estado
    onQuantityChange(originalId || productId, quantity, lotIndex);
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum produto encontrado com os filtros aplicados.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-1 px-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Produtos para Reposição ({displayedItems.length})
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 pb-20">
          {displayedItems.map((item) => (
            <Card key={item.id} className={cn(
              "overflow-hidden border-muted-foreground/10 hover:border-primary/50 transition-all",
              (item as any).isMultiLot && "border-l-4 border-l-primary/40 bg-primary/5"
            )}>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-lg leading-tight text-foreground">{item.descricao}</h4>
                      {(item as any).isMultiLot && (
                        <Badge variant="secondary" className="text-[9px] uppercase font-black tracking-widest bg-primary/20 text-primary animate-pulse">
                          Item Fracionado
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" /> {item.codigo}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" /> {item.unidade_medida}
                        {isCentralUnit && <span className="text-[10px] ml-1">(UNID MEDIDA)</span>}
                      </span>
                    </div>
                  </div>
                <div className="flex flex-col gap-2 shrink-0 items-end">
                  <Badge 
                    variant="outline" 
                    className={`font-bold ${
                      item.estoque_atual <= 10 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                      item.estoque_atual <= 50 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                      'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}
                  >
                    {item.estoque_atual} {isCentralUnit ? 'no Destino' : 'em estoque'}
                  </Badge>
                  {isCentralUnit && (
                    <Badge 
                      variant="outline" 
                      className={`font-bold ${
                        (item.estoque_origem || 0) <= 10 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                        (item.estoque_origem || 0) <= 50 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                        'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}
                    >
                      {(item as any).isMultiLot ? item.quantidade_reposicao : (item.estoque_origem || 0)} na Origem
                      {item.lote_selecionado && <span className="ml-1 opacity-60 text-[8px] font-normal">({item.lote_selecionado})</span>}
                    </Badge>
                  )}
                </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2 border-t border-muted/30">
                  <span className="text-sm font-medium text-muted-foreground">Qtd. Reposição</span>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={item.quantidade_reposicao || ''}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value, (item as any).originalId, (item as any).lotIndex)}
                    className={cn(
                      "w-24 text-center bg-muted/20 border-muted-foreground/20 focus:border-primary font-bold h-10"
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl">Produtos para Reposição ({displayedItems.length})</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm shadow-sm">
              <tr className="border-b">
                <th className="text-left p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Código</th>
                <th className="text-left p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Descrição</th>
                <th className="text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                  {isCentralUnit ? 'Unid Medida' : 'Unidade'}
                </th>
                {isCentralUnit && (
                  <th className="text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                    Unid Origem
                  </th>
                )}
                <th className="text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                  {isCentralUnit ? 'Unid Destino' : 'Estoque Atual'}
                </th>
                <th className="text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Qtd. Reposição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedItems.map((item) => (
                <tr key={item.id} className={cn(
                  "group transition-colors hover:bg-muted/40",
                  (item as any).isMultiLot && "bg-primary/5 border-l-4 border-l-primary/40"
                )}>
                  <td className="p-3 font-mono text-sm text-foreground/80">{item.codigo}</td>
                  <td className="p-3 text-foreground font-medium">
                    <div className="flex items-center gap-2">
                      {item.descricao}
                      {(item as any).isMultiLot && (
                        <Badge variant="outline" className="text-[8px] h-4 py-0 px-1 bg-primary/10 text-primary border-primary/30 uppercase font-black">
                          Fracionado
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-1 bg-blue-900/30 text-blue-300 border border-blue-800/50 rounded text-xs font-medium">
                      {item.unidade_medida}
                    </span>
                  </td>
                  {isCentralUnit && (
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`font-bold text-base ${
                          ((item as any).isMultiLot ? item.quantidade_reposicao : (item.estoque_origem || 0)) <= 10 ? 'text-red-500' : 
                          ((item as any).isMultiLot ? item.quantidade_reposicao : (item.estoque_origem || 0)) <= 50 ? 'text-amber-500' : 'text-emerald-500'
                        }`}>
                          {(item as any).isMultiLot ? item.quantidade_reposicao : (item.estoque_origem || 0)}
                        </span>
                        {item.lote_selecionado && (
                          <Badge variant="secondary" className="text-[9px] h-4 py-0 px-1 bg-primary/10 text-primary border-primary/20">
                            Lote: {item.lote_selecionado}
                          </Badge>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="p-3 text-center">
                    <span className={`font-bold text-base ${
                      item.estoque_atual <= 10 ? 'text-red-500' : 
                      item.estoque_atual <= 50 ? 'text-amber-500' : 'text-emerald-500'
                    }`}>
                      {item.estoque_atual}
                    </span>
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={item.quantidade_reposicao || ''}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value, (item as any).originalId, (item as any).lotIndex)}
                      className={cn(
                        "w-24 text-center mx-auto bg-background border-muted-foreground/20 focus:border-primary transition-all font-bold"
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
