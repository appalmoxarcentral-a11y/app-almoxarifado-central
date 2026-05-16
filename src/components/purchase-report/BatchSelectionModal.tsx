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
import { Package, Calendar, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PurchaseDraftItem } from '@/types/purchase-draft';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

interface LoteSelection {
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
  const { toast } = useToast();
  const [selections, setSelections] = useState<Record<string, LoteSelection[]>>({});

  const itemsToProcess = useMemo(() => {
    // 1. Filtrar APENAS os itens que têm quantidade de reposição > 0 na Tela 1
    // Isso é essencial para performance, pois buscar lotes para 500+ itens trava o sistema.
    const escolhidos = items.filter(item => (item.quantidade_reposicao || 0) > 0);
    
    // 2. Dentro dos escolhidos, separar os que ainda não têm lote para o topo
    const escolhidosPendentes = escolhidos.filter(item => {
      const hasLote = (item.lote_selecionado && item.vencimento_selecionado) || 
                      (item.lotes_multiplos && item.lotes_multiplos.length > 0 && item.lotes_multiplos[0].lote);
      return !hasLote;
    });
    
    const escolhidosConcluidos = escolhidos.filter(item => {
      const hasLote = (item.lote_selecionado && item.vencimento_selecionado) || 
                      (item.lotes_multiplos && item.lotes_multiplos.length > 0 && item.lotes_multiplos[0].lote);
      return hasLote;
    });

    // Retorna apenas os itens que o usuário está realmente processando
    return [...escolhidosPendentes, ...escolhidosConcluidos];
  }, [items]); // Ordem estática durante a edição no modal

  // Initialize selections with existing data if available
  useEffect(() => {
    if (isOpen) {
      const initialSelections: Record<string, LoteSelection[]> = {};
      itemsToProcess.forEach(item => {
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
          // A quantidade começa em 0 até que um lote seja selecionado
          initialSelections[item.id] = [{ 
            lote: '', 
            vencimento: '', 
            quantidade: 0 
          }];
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

  const handleAddLote = (itemId: string) => {
    setSelections(prev => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), { lote: '', vencimento: '', quantidade: 0 }]
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
      const itemLotes = allBatchesMap?.get(itemId) || [];
      const currentSelection = { ...prev[itemId][index], ...updates };
      
      // Validação de estoque máximo por lote
      if (currentSelection.lote && currentSelection.quantidade > 0) {
        const selectedLoteInfo = itemLotes.find(l => l.lote === currentSelection.lote);
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
    const updatedItems = items.map(item => {
      const itemSelections = selections[item.id];
      if (itemSelections && itemSelections.length > 0) {
        // Calcular a nova quantidade total baseada nos lotes selecionados
        const totalDaSelecao = itemSelections.reduce((sum, s) => sum + s.quantidade, 0);
        
        return {
          ...item,
          lotes_multiplos: itemSelections,
          quantidade_reposicao: totalDaSelecao, // Atualiza a quantidade para bater com os lotes
          // Mantém para compatibilidade, pega o primeiro lote se houver apenas um
          lote_selecionado: itemSelections.length === 1 ? itemSelections[0].lote : undefined,
          vencimento_selecionado: itemSelections.length === 1 ? itemSelections[0].vencimento : undefined
        };
      }
      return item;
    });
    onConfirm(updatedItems);
  };

  const isItemValid = (item: PurchaseDraftItem) => {
    const itemSelections = selections[item.id] || [];
    const hasQty = (item.quantidade_reposicao || 0) > 0;
    
    // Se o item não tem quantidade escolhida na tela 1, ele é válido (não precisa de lote)
    if (!hasQty) return true;
    
    // Se tem quantidade, deve ter pelo menos um lote selecionado e preenchido
    if (itemSelections.length === 0) return false;
    return itemSelections.every(s => s.lote && s.vencimento && s.quantidade > 0);
  };

  const canSave = itemsToProcess.every(isItemValid);

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
            const totalSelected = itemSelections.reduce((sum, s) => sum + s.quantidade, 0);
            const isComplete = totalSelected > 0 && totalSelected === item.quantidade_reposicao;
            const hasSelections = itemSelections.length > 0;

            return (
              <div key={item.id} className={cn(
                "p-5 border-2 rounded-2xl space-y-4 transition-all",
                totalSelected > 0 ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-muted-foreground/10"
              )}>
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
                    <Badge variant={totalSelected > 0 ? "default" : "outline"} className={cn(
                      "font-bold px-3 py-1",
                      totalSelected > 0 ? "bg-emerald-600 hover:bg-emerald-600" : "text-muted-foreground"
                    )}>
                      {totalSelected > 0 ? `TOTAL SELECIONADO: ${totalSelected}` : "AGUARDANDO LOTE"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  {itemSelections.map((sel, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-3 items-end bg-background/50 p-3 rounded-xl border border-muted-foreground/5">
                      <div className="flex-1 w-full space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Lote de Origem</Label>
                        <Select 
                          value={sel.lote ? `${sel.lote}|${sel.vencimento}` : undefined}
                          onValueChange={(val) => {
                            const [lote, venc] = val.split('|');
                            // Quando seleciona o lote pela primeira vez, traz a quantidade da imagem 1
                            const novaQuantidade = sel.quantidade === 0 ? (item.quantidade_reposicao || 0) : sel.quantidade;
                            
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
                          onChange={(e) => handleUpdateLote(item.id, idx, { quantidade: parseInt(e.target.value) || 0 })}
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
                    onClick={() => handleAddLote(item.id)}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
