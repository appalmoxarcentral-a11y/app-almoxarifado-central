import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { Package, Calendar, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseDraftItem, PurchaseDraftLotSelection } from '@/types/purchase-draft';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { buildLotBalancesByProduct } from './lot-balance-utils';

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

type LoteSelection = PurchaseDraftLotSelection;

export function BatchSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  items,
  originUnidadeId,
  isSaving = false
}: BatchSelectionModalProps) {
  const { toast } = useToast();
  const [selections, setSelections] = useState<Record<string, LoteSelection[]>>({});
  const [orderedItemIds, setOrderedItemIds] = useState<string[]>([]);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const processableItems = useMemo(() => {
    // Buscar lotes apenas para itens que realmente serão processados mantém o modal responsivo.
    return items.filter(item => (item.quantidade_reposicao || 0) > 0);
  }, [items]);

  // Initialize selections with existing data if available
  useEffect(() => {
    if (isOpen) {
      const initialSelections: Record<string, LoteSelection[]> = {};
      processableItems.forEach(item => {
        if (item.lotes_multiplos && item.lotes_multiplos.length > 0) {
          initialSelections[item.id] = [...item.lotes_multiplos];
        } else if (item.lote_selecionado && item.vencimento_selecionado) {
          initialSelections[item.id] = [{
            lote: item.lote_selecionado,
            vencimento: item.vencimento_selecionado,
            quantidade: item.quantidade_reposicao || 0
          }];
        } else {
          // Inicializa sempre com uma linha de seleção vazia para cada item
          // A quantidade começa igual ao pedido para deixar pendente apenas a escolha do lote.
          initialSelections[item.id] = [{ 
            lote: '', 
            vencimento: '', 
            quantidade: item.quantidade_reposicao || 0
          }];
        }
      });
      setSelections(initialSelections);
    }
  }, [isOpen, processableItems]);

  // Fetch all batches for all items in a single request (Batch)
  const { data: allBatchesMap, isLoading: isLoadingBatches } = useQuery({
    queryKey: ['lotes-multi-items', processableItems.map(i => i.id).sort(), originUnidadeId],
    queryFn: async () => {
      const itemIds = processableItems.map(i => i.id);
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

      return buildLotBalancesByProduct(entradas || [], saidas || []) as Map<string, LoteInfo[]>;
    },
    enabled: isOpen && !!originUnidadeId && processableItems.length > 0
  });

  const findSelectedLotInfo = React.useCallback((itemId: string, selection: Pick<LoteSelection, 'lote' | 'vencimento'>) => {
    const itemLotes = allBatchesMap?.get(itemId) || [];
    return itemLotes.find(l =>
      l.lote === selection.lote && l.vencimento === selection.vencimento
    );
  }, [allBatchesMap]);

  const getItemPendingIssues = React.useCallback((item: PurchaseDraftItem, selectionsMap?: Record<string, LoteSelection[]>) => {
    const requestedQty = item.quantidade_reposicao || 0;
    const itemSelections = selectionsMap?.[item.id] || selections[item.id] || [];
    const pendingIssues = new Set<string>();
    const quantityByLot = new Map<string, { selected: number; available: number }>();
    let totalSelected = 0;

    if (requestedQty <= 0) {
      return {
        totalSelected,
        isValid: true,
        pendingIssues: [] as string[]
      };
    }

    if (itemSelections.length === 0) {
      pendingIssues.add('Escolha um lote');
    }

    itemSelections.forEach(selection => {
      if (selection.quantidade && selection.quantidade > 0) {
        totalSelected += selection.quantidade;
      }

      if (!selection.lote || !selection.vencimento) {
        pendingIssues.add('Escolha um lote');
        return;
      }

      if (!selection.quantidade || selection.quantidade <= 0) {
        pendingIssues.add('Informe uma quantidade valida');
        return;
      }

      const selectedLotInfo = findSelectedLotInfo(item.id, selection);
      if (!selectedLotInfo) {
        pendingIssues.add('Selecione um lote disponivel');
        return;
      }

      const lotKey = `${selection.lote}|${selection.vencimento}`;
      const currentLot = quantityByLot.get(lotKey);
      quantityByLot.set(lotKey, {
        selected: (currentLot?.selected || 0) + selection.quantidade,
        available: selectedLotInfo.quantidade
      });

      if (selection.quantidade > selectedLotInfo.quantidade) {
        pendingIssues.add('Quantidade maior que o estoque do lote');
      }
    });

    quantityByLot.forEach(({ selected, available }) => {
      if (selected > available) {
        pendingIssues.add('Quantidade maior que o estoque do lote');
      }
    });

    if (totalSelected !== requestedQty) {
      pendingIssues.add('Total selecionado diferente do pedido');
    }

    return {
      totalSelected,
      isValid: pendingIssues.size === 0,
      pendingIssues: Array.from(pendingIssues)
    };
  }, [findSelectedLotInfo, selections]);

  useEffect(() => {
    if (!isOpen) {
      setOrderedItemIds([]);
      return;
    }

    const initialSelections: Record<string, LoteSelection[]> = {};
    processableItems.forEach(item => {
      if (item.lotes_multiplos && item.lotes_multiplos.length > 0) {
        initialSelections[item.id] = [...item.lotes_multiplos];
      } else if (item.lote_selecionado && item.vencimento_selecionado) {
        initialSelections[item.id] = [{
          lote: item.lote_selecionado,
          vencimento: item.vencimento_selecionado,
          quantidade: item.quantidade_reposicao || 0
        }];
      } else {
        initialSelections[item.id] = [{
          lote: '',
          vencimento: '',
          quantidade: item.quantidade_reposicao || 0
        }];
      }
    });

    const frozenOrder = [...processableItems]
      .sort((a, b) => {
        const aState = getItemPendingIssues(a, initialSelections);
        const bState = getItemPendingIssues(b, initialSelections);

        if (aState.isValid !== bState.isValid) {
          return aState.isValid ? 1 : -1;
        }

        if (aState.pendingIssues.length !== bState.pendingIssues.length) {
          return bState.pendingIssues.length - aState.pendingIssues.length;
        }

        return a.descricao.localeCompare(b.descricao, 'pt-BR', { sensitivity: 'base' });
      })
      .map(item => item.id);

    setOrderedItemIds(frozenOrder);
  }, [getItemPendingIssues, isOpen, processableItems]);

  const itemsToProcess = useMemo(() => {
    if (orderedItemIds.length === 0) {
      return processableItems;
    }

    const itemMap = new Map(processableItems.map(item => [item.id, item]));
    return orderedItemIds
      .map(itemId => itemMap.get(itemId))
      .filter((item): item is PurchaseDraftItem => !!item);
  }, [orderedItemIds, processableItems]);

  const keepItemInView = React.useCallback((itemId: string) => {
    const itemElement = itemRefs.current[itemId];
    if (!itemElement) return;

    itemElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }, []);

  const handleAddLote = (itemId: string) => {
    setSelections(prev => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), { lote: '', vencimento: '', quantidade: 0, saldo_origem_lote: undefined }]
    }));
  };

  const handleRemoveLote = (itemId: string, index: number) => {
    setSelections(prev => ({
      ...prev,
      [itemId]: prev[itemId].filter((_, i) => i !== index)
    }));
  };

  const handleUpdateLote = (itemId: string, index: number, updates: Partial<LoteSelection>) => {
    setSelections(prev => {
      const currentSelection = { ...prev[itemId][index], ...updates };
      const selectedLoteInfo = currentSelection.lote && currentSelection.vencimento
        ? findSelectedLotInfo(itemId, currentSelection)
        : undefined;

      currentSelection.saldo_origem_lote = selectedLoteInfo?.quantidade;
      
      // Validação de estoque máximo por lote
      if (currentSelection.lote && currentSelection.quantidade > 0) {
        if (selectedLoteInfo && currentSelection.quantidade > selectedLoteInfo.quantidade) {
          currentSelection.quantidade = selectedLoteInfo.quantidade;
          toast({
            title: "Quantidade ajustada ao saldo do lote",
            description: `O saldo disponível para o lote ${selectedLoteInfo.lote} é de ${selectedLoteInfo.quantidade}.`,
            variant: "destructive"
          });
        }
      }

      return {
        ...prev,
        [itemId]: prev[itemId].map((sel, i) => i === index ? currentSelection : sel)
      };
    });
  };

  const handleConfirm = () => {
    const hasPendingItems = processableItems.some(item => !getItemPendingIssues(item).isValid);
    if (hasPendingItems) {
      toast({
        title: 'Existem pendencias para resolver',
        description: 'Ajuste os itens destacados no topo antes de confirmar e salvar.',
        variant: 'destructive'
      });
      return;
    }

    const updatedItems = items.map(item => {
      const itemSelections = selections[item.id];
      if (itemSelections && itemSelections.length > 0) {
        const normalizedSelections = itemSelections
          .filter(selection => selection.lote && selection.vencimento && selection.quantidade > 0)
          .map(selection => {
            const matchedLot = findSelectedLotInfo(item.id, selection);
            return {
              ...selection,
              saldo_origem_lote: matchedLot?.quantidade ?? selection.saldo_origem_lote
            };
          });

        if (normalizedSelections.length === 0) {
          return item;
        }

        // Calcular a nova quantidade total baseada nos lotes selecionados
        const totalDaSelecao = normalizedSelections.reduce((sum, s) => sum + s.quantidade, 0);
        
        return {
          ...item,
          lotes_multiplos: normalizedSelections,
          quantidade_reposicao: totalDaSelecao, // Atualiza a quantidade para bater com os lotes
          // Mantém para compatibilidade, pega o primeiro lote se houver apenas um
          lote_selecionado: normalizedSelections.length === 1 ? normalizedSelections[0].lote : undefined,
          vencimento_selecionado: normalizedSelections.length === 1 ? normalizedSelections[0].vencimento : undefined
        };
      }
      return item;
    });
    onConfirm(updatedItems);
  };

  const isItemValid = (item: PurchaseDraftItem) => {
    return getItemPendingIssues(item).isValid;
  };

  const canSave = processableItems.length > 0 && processableItems.every(isItemValid);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-6 w-6 text-primary" />
            Seleção de Lotes para Reposição
          </DialogTitle>
          <DialogDescription className="text-sm">
            Como você está no Almoxarifado Central, selecione os lotes e as quantidades para cada item. 
            <strong> Dica:</strong> A quantidade total do pedido será ajustada automaticamente para somar os lotes escolhidos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {itemsToProcess.map((item) => {
            const lotesDisponiveis = allBatchesMap?.get(item.id) || [];
            const itemSelections = selections[item.id] || [];
            const { totalSelected, isValid, pendingIssues } = getItemPendingIssues(item);
            const isComplete = isValid;
            const hasPendingIssues = pendingIssues.length > 0;

            return (
              <div
                key={item.id}
                ref={(element) => {
                  itemRefs.current[item.id] = element;
                }}
                className={cn(
                  "p-5 border-2 rounded-2xl space-y-4 transition-all scroll-mt-24",
                  hasPendingIssues
                    ? "bg-amber-500/5 border-amber-500/30"
                    : totalSelected > 0
                      ? "bg-emerald-500/5 border-emerald-500/30"
                      : "bg-muted/20 border-muted-foreground/10"
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h4 className="font-black text-foreground text-lg uppercase tracking-tight">{item.descricao}</h4>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-[10px]">{item.codigo}</Badge>
                      <span className="text-xs text-muted-foreground font-medium">
                        Qtd. Original: <span className="font-bold">{item.quantidade_reposicao}</span> {item.unidade_medida}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={hasPendingIssues ? "secondary" : totalSelected > 0 ? "default" : "outline"} className={cn(
                      "font-bold px-3 py-1",
                      hasPendingIssues
                        ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
                        : totalSelected > 0
                          ? "bg-emerald-600 hover:bg-emerald-600"
                          : "text-muted-foreground"
                    )}>
                      {hasPendingIssues
                        ? `PENDENTE: ${pendingIssues[0]}`
                        : totalSelected > 0
                          ? `TOTAL SELECIONADO: ${totalSelected}`
                          : "AGUARDANDO LOTE"}
                    </Badge>
                    {hasPendingIssues && pendingIssues.length > 1 && (
                      <p className="mt-2 max-w-xs text-xs font-medium text-amber-700 dark:text-amber-300">
                        {pendingIssues.slice(1).join(' • ')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {itemSelections.map((sel, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-3 items-end bg-background/50 p-3 rounded-xl border border-muted-foreground/5">
                      <div className="flex-1 w-full space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Lote de Origem</Label>
                        <Select 
                          value={sel.lote ? `${sel.lote}|${sel.vencimento}` : undefined}
                          onOpenChange={(open) => {
                            if (open) {
                              keepItemInView(item.id);
                            }
                          }}
                          onValueChange={(val) => {
                            const [lote, venc] = val.split('|');
                            // Quando seleciona o lote pela primeira vez, traz a quantidade da imagem 1
                            const novaQuantidade = sel.quantidade === 0 ? (item.quantidade_reposicao || 0) : sel.quantidade;
                            
                            keepItemInView(item.id);
                            handleUpdateLote(item.id, idx, { 
                              lote, 
                              vencimento: venc,
                              quantidade: novaQuantidade
                            });
                          }}
                        >
                          <SelectTrigger className="bg-background h-10 border-muted-foreground/20">
                            <SelectValue placeholder="Selecione um lote..." />
                          </SelectTrigger>
                          <SelectContent>
                            {lotesDisponiveis.map((l, i) => (
                              <SelectItem key={i} value={`${l.lote}|${l.vencimento}`}>
                                <div className="flex flex-col">
                                  <span className="font-bold text-sm">Lote: {l.lote}</span>
                                  <span className="text-[10px] text-muted-foreground">Venc: {format(new Date(l.vencimento), 'dd/MM/yyyy')} • Saldo: {l.quantidade}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="w-full md:w-32 space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Quantidade</Label>
                        <Input
                          type="number"
                          value={sel.quantidade || ''}
                          onFocus={() => keepItemInView(item.id)}
                          onChange={(e) => {
                            keepItemInView(item.id);
                            handleUpdateLote(item.id, idx, { quantidade: parseInt(e.target.value) || 0 });
                          }}
                          className="h-10 text-center font-bold border-muted-foreground/20"
                          placeholder="0"
                        />
                      </div>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveLote(item.id, idx)}
                        className="text-destructive hover:bg-destructive/10 h-10 w-10 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      keepItemInView(item.id);
                      handleAddLote(item.id);
                    }}
                    className="w-full border-dashed border-2 hover:border-primary hover:text-primary transition-all h-10 font-bold text-xs"
                    disabled={isComplete || lotesDisponiveis.length <= 1}
                  >
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    ADICIONAR OUTRO LOTE PARA ESTE ITEM
                  </Button>
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

        <DialogFooter className="p-6 bg-background border-t shrink-0">
          <div className="flex w-full gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!canSave || itemsToProcess.length === 0 || isSaving}
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
          {!canSave && itemsToProcess.length > 0 && (
            <div className="flex w-full items-center gap-2 pt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Resolva as pendencias destacadas no topo para habilitar a confirmacao do pedido.
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
