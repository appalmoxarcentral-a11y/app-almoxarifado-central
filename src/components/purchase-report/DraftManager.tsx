import React, { useState } from 'react';
import { Save, FolderOpen, Plus, Trash2, Calendar, Copy, FileText, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, addMonths, format, startOfMonth, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import type { RascunhoCompra, PurchaseDraftItem } from '@/types/purchase-draft';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DraftManagerProps {
  drafts: RascunhoCompra[];
  currentDraftId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  canEditDraft: (draft: RascunhoCompra) => boolean;
  canDeleteDraft: (draft: RascunhoCompra) => boolean;
  onSaveDraft: (nome: string, items: PurchaseDraftItem[], unidade_id?: string) => void;
  onLoadDraft: (draft: RascunhoCompra) => PurchaseDraftItem[];
  onLoadDraftAsBase: (draft: RascunhoCompra) => PurchaseDraftItem[];
  onDeleteDraft: (draftId: string) => void;
  onCreateNew: (unidadeId?: string) => void;
  getCurrentDraft: () => RascunhoCompra & { unidade_nome?: string } | undefined;
  items: PurchaseDraftItem[];
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
  hasChanges?: boolean;
  onSetTargetUnidade?: (unidadeId: string) => void;
  targetUnidadeId?: string | null;
}

export function DraftManager({
  drafts,
  currentDraftId,
  isLoading,
  isSaving,
  canEditDraft,
  canDeleteDraft,
  onSaveDraft,
  onLoadDraft,
  onLoadDraftAsBase,
  onDeleteDraft,
  onCreateNew,
  getCurrentDraft,
  items,
  variant,
  className,
  hasChanges,
  onSetTargetUnidade,
  targetUnidadeId
}: DraftManagerProps) {
  const { hasPermission } = useAuth();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [createStepDialogOpen, setCreateStepDialogOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<'unit' | 'type' | 'base'>('type');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [manualDate, setManualDate] = useState(format(new Date(), 'dd/MM/yyyy'));

  const canSelectUnit = hasPermission('acesso_global_pedidos');

  const { data: unidades } = useQuery({
    queryKey: ['unidades_saude_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades_saude')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: loadDialogOpen || createStepDialogOpen
  });
  
  // Filtros
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterUnit, setFilterUnit] = useState<string>('all');

  const currentDraft = getCurrentDraft();
  const isMobileLayout = className?.includes('h-9') || className?.includes('h-10') || className?.includes('w-full');

  // Obter meses únicos dos rascunhos para o filtro
  const availableMonths = Array.from(new Set(drafts.map(d => {
    // Tenta extrair o mês/ano do nome do rascunho ou usa a data de criação
    if (d.nome_rascunho.includes('mês')) {
      return d.nome_rascunho.replace('Pedido ', '');
    }
    return format(new Date(d.data_criacao), "MMMM yyyy", { locale: ptBR });
  }))).sort();

  // Obter unidades únicas dos rascunhos para o filtro
  const availableUnits = Array.from(new Set(drafts.map(d => d.unidade_nome).filter(Boolean))).sort() as string[];

  // Aplicar filtros
  const filteredDrafts = drafts.filter(draft => {
    const matchesMonth = filterMonth === 'all' || 
      draft.nome_rascunho.includes(filterMonth) || 
      format(new Date(draft.data_criacao), "MMMM yyyy", { locale: ptBR }).includes(filterMonth);
    
    const matchesUnit = filterUnit === 'all' || draft.unidade_nome === filterUnit;
    
    return matchesMonth && matchesUnit;
  });

  const handleSave = () => {
    if (currentDraft) {
      // Atualizar rascunho existente
      onSaveDraft(currentDraft.nome_rascunho, items);
    } else {
      // Criar novo rascunho
      const now = new Date();
      setCalendarDate(now);
      setManualDate(format(now, 'dd/MM/yyyy'));
      setDescription('');
      setSaveDialogOpen(true);
    }
  };

  const handleSaveNew = () => {
    if (manualDate && description.trim()) {
      // Garantir o prefixo "Pedido " se não existir
      const datePart = manualDate.trim();
      const finalName = `Pedido ${datePart} - ${description.trim()}`;
      onSaveDraft(finalName, items, targetUnidadeId || undefined);
      setDescription('');
      setSaveDialogOpen(false);
    }
  };

  const handleLoadDraft = (draft: RascunhoCompra) => {
    onLoadDraft(draft);
    setLoadDialogOpen(false);
  };

  const handleCreateNew = () => {
    setLoadDialogOpen(false);
    if (canSelectUnit) {
      setCreationMode('unit');
    } else {
      setCreationMode('type');
    }
    setCreateStepDialogOpen(true);
  };

  const handleUnitSelected = (unitId: string) => {
    setSelectedUnitId(unitId);
    if (onSetTargetUnidade) {
      onSetTargetUnidade(unitId);
    }
    setCreationMode('type');
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setCalendarDate(date);
      setManualDate(format(date, 'dd/MM/yyyy'));
    }
  };

  const handleManualDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove não dígitos
    
    // Aplicar máscara dd/mm/yyyy
    if (value.length > 8) value = value.substring(0, 8);
    
    let formatted = value;
    if (value.length > 2) formatted = value.substring(0, 2) + '/' + value.substring(2);
    if (value.length > 4) formatted = formatted.substring(0, 5) + '/' + formatted.substring(5);
    
    setManualDate(formatted);
    
    // Se estiver completo, tentar atualizar o calendário
    if (value.length === 8) {
      const day = parseInt(value.substring(0, 2));
      const month = parseInt(value.substring(2, 4)) - 1;
      const year = parseInt(value.substring(4, 8));
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        setCalendarDate(date);
      }
    }
  };

  const handleStartFromScratch = () => {
    onCreateNew(selectedUnitId || undefined);
    setCreateStepDialogOpen(false);
    const now = new Date();
    setCalendarDate(now);
    setManualDate(format(now, 'dd/MM/yyyy'));
    setDescription('');
    setSaveDialogOpen(true);
  };

  const handleBaseOnExisting = () => {
    setCreationMode('base');
  };

  const handleSelectBaseDraft = (draft: RascunhoCompra) => {
    onLoadDraftAsBase(draft);
    setCreateStepDialogOpen(false);
    const now = new Date();
    setCalendarDate(now);
    setManualDate(format(now, 'dd/MM/yyyy'));
    setDescription('');
    setSaveDialogOpen(true);
  };

  const baseDrafts = selectedUnitId 
    ? drafts.filter(d => d.unidade_id === selectedUnitId)
    : drafts;

  const getItemsWithQuantity = (draftItems: PurchaseDraftItem[]) => {
    return draftItems.filter(item => item.quantidade_reposicao && item.quantidade_reposicao > 0).length;
  };

  return (
    <div className={`flex items-center ${isMobileLayout ? 'gap-1' : 'gap-2'} w-full`}>
      {currentDraft && !isMobileLayout && (
        <Badge variant="outline" className="text-xs">
          {currentDraft.nome_rascunho}
        </Badge>
      )}
      
      <Button
        onClick={handleSave}
        disabled={isSaving || (currentDraftId !== null && !hasChanges)}
        size="sm"
        className={cn(
          "transition-all active:scale-95 flex-1", 
          isMobileLayout ? "bg-orange-600 hover:bg-orange-700 text-white border-none" : "",
          className
        )}
      >
        <Save className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate ml-1">Salvar</span>
      </Button>

      {(isMobileLayout || !className) && (
        <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              variant={isMobileLayout ? "secondary" : "outline"}
              className={cn(
                "transition-all active:scale-95 flex-1", 
                isMobileLayout ? "bg-slate-800 text-white hover:bg-slate-700 border-none" : "",
                className
              )}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate ml-1">Pedidos</span>
            </Button>
          </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Pedidos</DialogTitle>
            <DialogDescription>
              Escolha um pedido existente para editar ou crie um novo pedido do zero.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por Data" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Datas</SelectItem>
                  {availableMonths.map(month => (
                    <SelectItem key={month} value={month}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterUnit} onValueChange={setFilterUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Unidades</SelectItem>
                  {availableUnits.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleCreateNew}
              className="w-full justify-start h-12"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido
            </Button>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredDrafts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum pedido encontrado com os filtros selecionados
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredDrafts.map((draft) => (
                  <div key={draft.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {draft.nome_rascunho.startsWith('Pedido mês') ? (
                          <Calendar className="h-4 w-4 text-primary" />
                        ) : null}
                        <h4 className="font-medium">{draft.nome_rascunho}</h4>
                        {draft.id === currentDraftId && (
                          <Badge variant="default" className="text-xs">Atual</Badge>
                        )}
                        {draft.status === 'autorizado' && (
                          <Badge className="text-[10px] bg-green-600 hover:bg-green-700">Autorizado</Badge>
                        )}
                        {draft.status === 'entregue' && (
                          <Badge className="text-[10px] bg-blue-600 hover:bg-blue-700">Entregue</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-primary/70">{draft.unidade_origem_nome || 'Almoxarifado'}</span>
                          <ChevronRight className="h-3 w-3" />
                          <span>{draft.unidade_nome || 'Unidade destino'}</span>
                        </div>
                        {getItemsWithQuantity(draft.dados_produtos)} produtos com quantidade • {' '}
                        {formatDistanceToNow(new Date(draft.data_atualizacao), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleLoadDraft(draft)}
                        size="sm"
                        variant="outline"
                        disabled={draft.id === currentDraftId}
                      >
                        {draft.id === currentDraftId ? 'Atual' : 'Carregar'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            disabled={!canDeleteDraft(draft)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o pedido "{draft.nome_rascunho}"? 
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => onDeleteDraft(draft.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      )}

      <Dialog open={createStepDialogOpen} onOpenChange={setCreateStepDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Pedido</DialogTitle>
            <DialogDescription>
              {creationMode === 'unit' ? 'Selecione para qual unidade deseja criar o pedido.' : 'Como deseja iniciar este novo pedido?'}
            </DialogDescription>
          </DialogHeader>

          {creationMode === 'unit' ? (
            <div className="space-y-4 py-4">
              <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                {unidades?.map((unidade) => (
                  <Button
                    key={unidade.id}
                    variant="outline"
                    className="w-full justify-between h-auto p-4 text-left hover:border-primary group transition-all"
                    onClick={() => handleUnitSelected(unidade.id)}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="font-bold text-foreground group-hover:text-primary">{unidade.nome}</div>
                      <div className="text-xs text-muted-foreground">Clique para selecionar esta unidade</div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-1" />
                  </Button>
                ))}
                {(!unidades || unidades.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma unidade de saúde encontrada.
                  </div>
                )}
              </div>
            </div>
          ) : creationMode === 'type' ? (
            <div className="grid grid-cols-1 gap-4 py-4">
              <Button 
                variant="outline" 
                className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5"
                onClick={handleStartFromScratch}
              >
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <div className="font-semibold">Pedido do Zero</div>
                  <div className="text-xs text-muted-foreground">Inicia com todos os itens vazios</div>
                </div>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5"
                onClick={handleBaseOnExisting}
                disabled={baseDrafts.length === 0}
              >
                <Copy className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <div className="font-semibold">Basear em Pedido</div>
                  <div className="text-xs text-muted-foreground">Copia as quantidades de um pedido anterior</div>
                </div>
              </Button>
              {canSelectUnit && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-2 text-primary hover:underline"
                  onClick={() => setCreationMode('unit')}
                >
                  Alterar Unidade Selecionada
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-0 h-auto font-normal text-primary hover:underline"
                  onClick={() => setCreationMode('type')}
                >
                  Voltar
                </Button>
                <span>/ Selecionar pedido base</span>
              </div>
              
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {baseDrafts.map((draft) => (
                  <Button
                    key={draft.id}
                    variant="outline"
                    className="w-full justify-between h-auto p-3 text-left hover:border-primary"
                    onClick={() => handleSelectBaseDraft(draft)}
                  >
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div className="font-medium truncate">{draft.nome_rascunho}</div>
                      <div className="text-xs text-muted-foreground">
                        {getItemsWithQuantity(draft.dados_produtos)} produtos • {formatDistanceToNow(new Date(draft.data_atualizacao), { locale: ptBR, addSuffix: true })}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Novo Pedido</DialogTitle>
            <DialogDescription>
              Selecione a data e informe uma descrição curta para este pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="draft-date">Data do Pedido (Calendário ou Digite)</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  id="draft-date"
                  value={manualDate}
                  onChange={handleManualDateChange}
                  placeholder="DD/MM/YYYY"
                  className="flex-1"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0">
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <CalendarComponent
                      mode="single"
                      selected={calendarDate}
                      onSelect={handleCalendarSelect}
                      initialFocus
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Será salvo como: <span className="font-semibold text-primary">Pedido {manualDate}</span>
              </p>
            </div>
            <div>
              <Label htmlFor="draft-description">Descrição do Pedido *</Label>
              <Input
                id="draft-description"
                className="mt-1.5"
                value={description}
                onChange={(e) => setDescription(e.target.value.substring(0, 30))}
                placeholder="Ex: Reposição Semanal"
                maxLength={30}
                required
              />
              <p className="text-[10px] text-muted-foreground mt-1.5 flex justify-between">
                <span>Campo obrigatório</span>
                <span>{description.length}/30 caracteres</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveNew}
              disabled={!description.trim() || manualDate.length < 10 || isSaving}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}