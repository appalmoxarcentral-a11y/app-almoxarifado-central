
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Package, Hash, Layers, ArrowUpDown, FileText } from 'lucide-react';
import type { PurchaseItem } from '@/types/purchase';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface PurchaseTableProps {
  items: PurchaseItem[];
  onQuantityChange: (productId: string, quantity: number | undefined) => void;
  onAnnotationChange: (productId: string, annotation: string | undefined) => void;
  unidadeDestinoNome?: string;
  isCentralUnit?: boolean;
  stickyTopOffset?: number;
  sortColumn?: 'none' | 'unidade_medida' | 'estoque_origem' | 'estoque_atual' | 'quantidade_reposicao' | 'anotacoes';
  sortDirection?: 'asc' | 'desc';
  onSortColumnChange: (value: 'none' | 'unidade_medida' | 'estoque_origem' | 'estoque_atual' | 'quantidade_reposicao' | 'anotacoes') => void;
  onSortDirectionChange: (value: 'asc' | 'desc') => void;
}

export function PurchaseTable({
  items,
  onQuantityChange,
  onAnnotationChange,
  unidadeDestinoNome,
  isCentralUnit,
  stickyTopOffset = 120,
  sortColumn = 'none',
  sortDirection = 'asc',
  onSortColumnChange,
  onSortDirectionChange
}: PurchaseTableProps) {
  const isMobile = useIsMobile();
  const isAnnotationFilterActive = sortColumn === 'anotacoes';
  const [openAnnotationId, setOpenAnnotationId] = React.useState<string | null>(null);
  const availableSortColumns = [
    { value: 'none', label: 'Ordem padrao' },
    { value: 'anotacoes', label: 'Com anotacoes' },
    { value: 'unidade_medida', label: 'Unid. Medida' },
    ...(isCentralUnit ? [
      { value: 'estoque_origem', label: 'Unid. Origem' },
      { value: 'estoque_atual', label: 'Unid. Destino' }
    ] : [
      { value: 'estoque_atual', label: 'Estoque Atual' }
    ]),
    { value: 'quantidade_reposicao', label: 'Qtd. Reposicao' }
  ] as const;

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

  const handleAnnotationChange = (productId: string, value: string, originalId?: string) => {
    onAnnotationChange(originalId || productId, value || undefined);
  };

  const renderQuantityField = (item: PurchaseItem & { originalId?: string; lotIndex?: number }) => {
    const hasAnnotation = Boolean(item.anotacao_reposicao?.trim());
    const fieldId = item.id;
    const quantityText = item.quantidade_reposicao === undefined ? '' : String(item.quantidade_reposicao);
    const inputWidthInCh = Math.min(Math.max((quantityText || '0').length + 4, 7), 14);

    return (
      <div className="relative w-fit mx-auto">
        <HoverCard openDelay={150} closeDelay={100}>
          <HoverCardTrigger asChild>
            <div className="relative">
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={item.quantidade_reposicao || ''}
                onChange={(e) => handleQuantityChange(item.id, e.target.value, item.originalId, item.lotIndex)}
                style={{ width: `calc(${inputWidthInCh}ch + 1.5rem)` }}
                className={cn(
                  "min-w-[6.5rem] max-w-[12rem] pr-10 text-center mx-auto bg-background border-muted-foreground/20 focus:border-primary transition-all font-bold text-sm md:text-base font-mono tabular-nums",
                  hasAnnotation && "border-amber-300/60 bg-amber-400/10 hover:bg-amber-400/15 focus:bg-amber-400/10"
                )}
                title={hasAnnotation ? item.anotacao_reposicao : undefined}
              />
              <Popover open={openAnnotationId === fieldId} onOpenChange={(open) => setOpenAnnotationId(open ? fieldId : null)}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={hasAnnotation ? "Editar anotacao da reposicao" : "Adicionar anotacao da reposicao"}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center transition-all",
                      hasAnnotation
                        ? "bg-amber-400/20 text-amber-300 hover:bg-amber-400/30"
                        : "text-muted-foreground/60 hover:text-amber-300 hover:bg-amber-400/10"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText className={cn("h-3.5 w-3.5", hasAnnotation && "animate-pulse")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 space-y-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">Anotacao da Reposicao</p>
                    <p className="text-xs text-muted-foreground">
                      Essa observacao fica vinculada a este campo e nao atrapalha a edicao da quantidade.
                    </p>
                  </div>
                  <Textarea
                    value={item.anotacao_reposicao || ''}
                    onChange={(e) => handleAnnotationChange(item.id, e.target.value, item.originalId)}
                    placeholder="Digite uma observacao para este item..."
                    className="min-h-[110px] resize-none"
                    maxLength={240}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {(item.anotacao_reposicao || '').length}/240
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleAnnotationChange(item.id, '', item.originalId)}
                    >
                      Limpar anotacao
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {hasAnnotation && (
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-300" />
                </span>
              )}
            </div>
          </HoverCardTrigger>
          {hasAnnotation && (
            <HoverCardContent align="end" className="w-72 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Anotacao
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                {item.anotacao_reposicao}
              </p>
            </HoverCardContent>
          )}
        </HoverCard>
      </div>
    );
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
          <div className="grid grid-cols-1 gap-2 pt-2">
            <Select value={sortColumn} onValueChange={onSortColumnChange}>
              <SelectTrigger className="h-10 bg-muted/20 border-muted-foreground/10">
                <SelectValue placeholder="Escolha a coluna" />
              </SelectTrigger>
              <SelectContent>
                {availableSortColumns.map(column => (
                  <SelectItem key={column.value} value={column.value}>
                    {column.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortDirection} onValueChange={onSortDirectionChange} disabled={sortColumn === 'none' || isAnnotationFilterActive}>
              <SelectTrigger className="h-10 bg-muted/20 border-muted-foreground/10">
                <SelectValue placeholder="Direcao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Crescente</SelectItem>
                <SelectItem value="desc">Decrescente</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                  {renderQuantityField(item as any)}
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
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl">Produtos para Reposição ({displayedItems.length})</CardTitle>
        </div>
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
            Ordenacao
          </div>
          <Select value={sortColumn} onValueChange={onSortColumnChange}>
            <SelectTrigger className="w-full md:w-[190px] h-10 bg-muted/20 border-muted-foreground/10">
              <SelectValue placeholder="Escolha a coluna" />
            </SelectTrigger>
            <SelectContent>
              {availableSortColumns.map(column => (
                <SelectItem key={column.value} value={column.value}>
                  {column.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortDirection} onValueChange={onSortDirectionChange} disabled={sortColumn === 'none' || isAnnotationFilterActive}>
            <SelectTrigger className="w-full md:w-[160px] h-10 bg-muted/20 border-muted-foreground/10">
              <SelectValue placeholder="Direcao" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Crescente</SelectItem>
              <SelectItem value="desc">Decrescente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-visible">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th style={{ top: `${stickyTopOffset}px` }} className="sticky z-20 text-left p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider bg-muted/95 shadow-sm">Código</th>
                <th style={{ top: `${stickyTopOffset}px` }} className="sticky z-20 text-left p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider bg-muted/95 shadow-sm">Descrição</th>
                <th style={{ top: `${stickyTopOffset}px` }} className="sticky z-20 text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider bg-muted/95 shadow-sm">
                  {isCentralUnit ? 'Unid Medida' : 'Unidade'}
                </th>
                {isCentralUnit && (
                  <th style={{ top: `${stickyTopOffset}px` }} className="sticky z-20 text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider bg-muted/95 shadow-sm">
                    Unid Origem
                  </th>
                )}
                <th style={{ top: `${stickyTopOffset}px` }} className="sticky z-20 text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider bg-muted/95 shadow-sm">
                  {isCentralUnit ? 'Unid Destino' : 'Estoque Atual'}
                </th>
                <th style={{ top: `${stickyTopOffset}px` }} className="sticky z-20 text-center p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider bg-muted/95 shadow-sm">Qtd. Reposição</th>
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
                    {renderQuantityField(item as any)}
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
