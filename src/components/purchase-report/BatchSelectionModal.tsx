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
import { useQueries } from '@tanstack/react-query';
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
  originUnidadeId
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

  // Fetch batches for each item in parallel
  const batchQueries = useQueries({
    queries: itemsToProcess.map(item => ({
      queryKey: ['lotes-item', item.id, originUnidadeId],
      queryFn: async () => {
        console.log(`🔍 Buscando lotes para ${item.descricao} na unidade ${originUnidadeId}`);
        const { data, error } = await supabase
          .from('entradas_produtos')
          .select('lote, vencimento, quantidade')
          .eq('produto_id', item.id)
          .eq('unidade_id', originUnidadeId)
          .order('vencimento', { ascending: true });

        if (error) throw error;

        // Group by batch and sum quantity (simplified, real logic might need to subtract outflows)
        const grouped = data.reduce((acc: Record<string, LoteInfo>, current) => {
          const key = `${current.lote}-${current.vencimento}`;
          if (!acc[key]) {
            acc[key] = {
              lote: current.lote,
              vencimento: current.vencimento,
              quantidade: 0
            };
          }
          acc[key].quantidade += current.quantidade;
          return acc;
        }, {});

        // Fetch outflows for these batches to get real balance
        const { data: saidas } = await supabase
          .from('dispensacoes')
          .select('lote, quantidade')
          .eq('produto_id', item.id)
          .eq('unidade_id', originUnidadeId);

        saidas?.forEach(s => {
          // This is a bit tricky since dispensacoes might not have vencimento linked exactly in the same way
          // We'll match by lote for now as a heuristic
          Object.values(grouped).forEach(g => {
            if (g.lote === s.lote) {
              g.quantidade -= s.quantidade;
            }
          });
        });

        return Object.values(grouped).filter(g => g.quantidade > 0);
      },
      enabled: isOpen && !!originUnidadeId
    }))
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Seleção de Lotes para Reposição
          </DialogTitle>
          <DialogDescription>
            Como você está no Almoxarifado Central, selecione os lotes que serão utilizados para esta reposição. 
            Esta ação registrará a saída destes lotes da sua unidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {itemsToProcess.map((item, index) => {
            const query = batchQueries[index];
            const lotes = query.data || [];
            const isLoading = query.isLoading;

            return (
              <div key={item.id} className="p-4 border rounded-lg bg-muted/20 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-foreground">{item.descricao}</h4>
                    <p className="text-xs text-muted-foreground">Código: {item.codigo} • Qtd. Reposição: <span className="font-bold text-primary">{item.quantidade_reposicao}</span></p>
                  </div>
                  <Badge variant="outline" className="bg-background">
                    {item.unidade_medida}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Escolha o Lote de Origem</Label>
                  {isLoading ? (
                    <div className="h-10 w-full animate-pulse bg-muted rounded-md" />
                  ) : lotes.length > 0 ? (
                    <Select 
                      value={selections[item.id]?.lote ? `${selections[item.id].lote}|${selections[item.id].vencimento}` : undefined}
                      onValueChange={(val) => {
                        const [lote, venc] = val.split('|');
                        handleSelect(item.id, lote, venc);
                      }}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecione um lote disponível..." />
                      </SelectTrigger>
                      <SelectContent>
                        {lotes.map((l, i) => (
                          <SelectItem key={i} value={`${l.lote}|${l.vencimento}`}>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold">Lote: {l.lote}</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> 
                                Venc: {format(new Date(l.vencimento), 'dd/MM/yyyy')} • Saldo: {l.quantidade}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-destructive/5 border border-destructive/20 rounded text-destructive text-xs">
                      <AlertCircle className="h-4 w-4" />
                      Não há lotes com saldo positivo para este produto no Almoxarifado Central.
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {itemsToProcess.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum item com quantidade de reposição selecionada.
            </div>
          )}
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!allSelected || itemsToProcess.length === 0}
            className="bg-primary hover:bg-primary/90"
          >
            Confirmar e Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
