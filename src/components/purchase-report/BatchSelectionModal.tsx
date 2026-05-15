import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseDraftItem } from '@/types/purchase-draft';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BatchSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updatedItems: PurchaseDraftItem[]) => void;
  items: PurchaseDraftItem[];
  originUnidadeId: string;
  isSaving?: boolean;
}

interface LoteInfo {
  lote: string;
  vencimento: string;
  quantidade: number;
}

export function BatchSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  items,
  originUnidadeId,
  isSaving = false
}: BatchSelectionModalProps) {
  const [selections, setSelections] = useState<Record<string, { lote: string; vencimento: string }>>({});

  const itemsToProcess = useMemo(() => {
    return items
      .filter(item => (item.quantidade_reposicao || 0) > 0)
      .sort((a, b) => {
        const hasA = selections[a.id] ? 1 : 0;
        const hasB = selections[b.id] ? 1 : 0;
        if (hasA !== hasB) return hasA - hasB;
        return a.descricao.localeCompare(b.descricao);
      });
  }, [items, selections]);

  // Initialize selections with existing data if available
  useEffect(() => {
    if (isOpen) {
      const initialSelections: Record<string, { lote: string; vencimento: string }> = {};
      itemsToProcess.forEach(item => {
        if (item.lote_selecionado && item.vencimento_selecionado) {
          initialSelections[item.id] = {
            lote: item.lote_selecionado,
            vencimento: item.vencimento_selecionado
          };
        }
      });
      setSelections(initialSelections);
    }
  }, [isOpen, items]);

  // Fetch all batches for all items in a single request (Batch)
  const { data: allBatchesMap, isLoading: isLoadingBatches } = useQuery({
    queryKey: ['lotes-multi-items', itemsToProcess.map(i => i.id), originUnidadeId],
    queryFn: async () => {
      const itemIds = itemsToProcess.map(i => i.id);
      if (itemIds.length === 0) return new Map();

      console.log(`🔍 Buscando lotes em massa para ${itemIds.length} itens na unidade ${originUnidadeId}`);
      
      // 1. Buscar todas as entradas dos produtos selecionados
      const { data: entradas, error: entError } = await supabase
        .from('entradas_produtos')
        .select('produto_id, lote, vencimento, quantidade')
        .in('produto_id', itemIds)
        .eq('unidade_id', originUnidadeId)
        .order('vencimento', { ascending: true });

      if (entError) throw entError;

      // 2. Buscar todas as saídas (dispensações) dos produtos selecionados
      const { data: saidas, error: saiError } = await supabase
        .from('dispensacoes')
        .select('produto_id, lote, quantidade')
        .in('produto_id', itemIds)
        .eq('unidade_id', originUnidadeId);

      if (saiError) throw saiError;

      // 3. Processar saldos por produto e lote
      const resultMap = new Map<string, LoteInfo[]>();

      itemIds.forEach(id => {
        const itemEntradas = entradas?.filter(e => e.produto_id === id) || [];
        const itemSaidas = saidas?.filter(s => s.produto_id === id) || [];

        const grouped: Record<string, LoteInfo> = {};

        itemEntradas.forEach(e => {
          const key = `${e.lote}-${e.vencimento}`;
          if (!grouped[key]) {
            grouped[key] = { lote: e.lote, vencimento: e.vencimento, quantidade: 0 };
          }
          grouped[key].quantidade += e.quantidade;
        });

        itemSaidas.forEach(s => {
          // Heurística de lote (como no código anterior)
          Object.values(grouped).forEach(g => {
            if (g.lote === s.lote) {
              g.quantidade -= s.quantidade;
            }
          });
        });

        resultMap.set(id, Object.values(grouped).filter(g => g.quantidade > 0));
      });

      return resultMap;
    },
    enabled: isOpen && !!originUnidadeId && itemsToProcess.length > 0
  });

  const handleSelect = (itemId: string, lote: string, vencimento: string) => {
    setSelections(prev => ({
      ...prev,
      [itemId]: { lote, vencimento }
    }));
  };

  const handleConfirm = () => {
    const updatedItems = items.map(item => {
      const selection = selections[item.id];
      if (selection) {
        return {
          ...item,
          lote_selecionado: selection.lote,
          vencimento_selecionado: selection.vencimento
        };
      }
      return item;
    });
    onConfirm(updatedItems);
  };

  const allSelected = itemsToProcess.every(item => selections[item.id]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-6 w-6 text-primary" />
            Seleção de Lotes para Reposição
          </DialogTitle>
          <DialogDescription className="text-sm">
            Como você está no Almoxarifado Central, selecione os lotes que serão utilizados para esta reposição. 
            Esta ação registrará a saída destes lotes da sua unidade.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {itemsToProcess.map((item) => {
            const lotes = allBatchesMap?.get(item.id) || [];
            const isLoadingItem = isLoadingBatches;

            return (
              <div key={item.id} className="p-4 border rounded-xl bg-muted/20 space-y-3 transition-colors hover:border-primary/30">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-foreground text-base">{item.descricao}</h4>
                    <p className="text-xs text-muted-foreground">
                      Código: <span className="font-mono">{item.codigo}</span> • Qtd. Reposição: <span className="font-bold text-primary text-sm">{item.quantidade_reposicao}</span>
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {item.unidade_medida}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lote de Origem</Label>
                  {isLoadingItem ? (
                    <div className="h-10 w-full animate-pulse bg-muted rounded-lg" />
                  ) : lotes.length > 0 ? (
                    <Select 
                      value={selections[item.id]?.lote ? `${selections[item.id].lote}|${selections[item.id].vencimento}` : undefined}
                      onValueChange={(val) => {
                        const [lote, venc] = val.split('|');
                        handleSelect(item.id, lote, venc);
                      }}
                    >
                      <SelectTrigger className="bg-background h-11 border-muted-foreground/20 focus:ring-primary">
                        <SelectValue placeholder="Selecione um lote disponível..." />
                      </SelectTrigger>
                      <SelectContent>
                        {lotes.map((l, i) => (
                          <SelectItem key={i} value={`${l.lote}|${l.vencimento}`} className="py-3">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-sm">Lote: {l.lote}</span>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" /> 
                                  Venc: {format(new Date(l.vencimento), 'dd/MM/yyyy')}
                                </span>
                                <span className="flex items-center gap-1 font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  Saldo: {l.quantidade}
                                </span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive text-xs font-medium">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Não há lotes com saldo positivo para este produto no Almoxarifado Central.
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {itemsToProcess.length === 0 && (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
              <Package className="h-12 w-12 opacity-20" />
              <p>Nenhum item com quantidade de reposição selecionada.</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-background border-t">
          <div className="flex w-full gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!allSelected || itemsToProcess.length === 0 || isSaving}
              className="flex-[2] bg-primary hover:bg-primary/90 font-bold"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Processando {itemsToProcess.length} itens...
                </div>
              ) : (
                `Confirmar e Salvar ${itemsToProcess.length} itens`
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
