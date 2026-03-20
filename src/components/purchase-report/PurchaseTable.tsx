
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Package, Hash, Layers } from 'lucide-react';
import type { PurchaseItem } from '@/types/purchase';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';

interface PurchaseTableProps {
  items: PurchaseItem[];
  onQuantityChange: (productId: string, quantity: number | undefined) => void;
}

export function PurchaseTable({ items, onQuantityChange }: PurchaseTableProps) {
  const isMobile = useIsMobile();
  const handleQuantityChange = (productId: string, value: string) => {
    const quantity = value === '' ? undefined : parseInt(value);
    if (quantity !== undefined && quantity < 0) return;
    onQuantityChange(productId, quantity);
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
            Produtos para Reposição ({items.length})
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-4 pb-20">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden border-muted-foreground/10 hover:border-primary/50 transition-all">
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 flex-1">
                    <h4 className="font-bold text-lg leading-tight text-foreground">{item.descricao}</h4>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" /> {item.codigo}
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" /> {item.unidade_medida}
                      </span>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`shrink-0 font-bold ${
                      item.estoque_atual <= 10 ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                      item.estoque_atual <= 50 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                      'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}
                  >
                    {item.estoque_atual} em estoque
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2 border-t border-muted/30">
                  <span className="text-sm font-medium text-muted-foreground">Qtd. Reposição</span>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={item.quantidade_reposicao || ''}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    className="w-24 text-center bg-muted/20 border-muted-foreground/20 focus:border-primary font-bold h-10"
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
          <CardTitle className="text-xl">Produtos para Reposição ({items.length})</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm shadow-sm">
              <tr className="border-b">
                <th className="text-left p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Código</th>
                <th className="text-left p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Descrição</th>
                <th className="text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Unidade</th>
                <th className="text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Estoque Atual</th>
                <th className="text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Qtd. Reposição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={item.id} className="group transition-colors hover:bg-muted/40">
                  <td className="p-3 font-mono text-sm text-foreground/80">{item.codigo}</td>
                  <td className="p-3 text-foreground font-medium">{item.descricao}</td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-1 bg-blue-900/30 text-blue-300 border border-blue-800/50 rounded text-xs font-medium">
                      {item.unidade_medida}
                    </span>
                  </td>
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
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      className="w-24 text-center mx-auto bg-background border-muted-foreground/20 focus:border-primary transition-all font-bold"
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
