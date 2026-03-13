import React, { useState } from 'react';
import { Save, FolderOpen, Plus, Trash2, Calendar, Copy, FileText, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatDistanceToNow, addMonths, format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RascunhoCompra, PurchaseDraftItem } from '@/types/purchase-draft';

interface DraftManagerProps {
  drafts: RascunhoCompra[];
  currentDraftId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  canEditDraft: (draft: RascunhoCompra) => boolean;
  canDeleteDraft: (draft: RascunhoCompra) => boolean;
  onSaveDraft: (nome: string, items: PurchaseDraftItem[]) => void;
  onLoadDraft: (draft: RascunhoCompra) => PurchaseDraftItem[];
  onLoadDraftAsBase: (draft: RascunhoCompra) => PurchaseDraftItem[];
  onDeleteDraft: (draftId: string) => void;
  onCreateNew: () => void;
  getCurrentDraft: () => RascunhoCompra | undefined;
  items: PurchaseDraftItem[];
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
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
  className
}: DraftManagerProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [createStepDialogOpen, setCreateStepDialogOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<'type' | 'base'>('type');
  const [draftName, setDraftName] = useState('');

  const currentDraft = getCurrentDraft();
  const isMobileLayout = className?.includes('h-10'); // Heurística baseada no layout mobile do PurchaseReport

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    for (let i = 0; i < 4; i++) {
      const date = addMonths(now, i);
      const label = format(date, "'Pedido mês' MMMM yyyy", { locale: ptBR });
      options.push({ label, value: label });
    }
    
    return options;
  };

  const monthOptions = getMonthOptions();

  const handleSave = () => {
    if (currentDraft) {
      // Atualizar rascunho existente
      onSaveDraft(currentDraft.nome_rascunho, items);
    } else {
      // Criar novo rascunho
      setDraftName(monthOptions[0].value);
      setSaveDialogOpen(true);
    }
  };

  const handleSaveNew = () => {
    if (draftName.trim()) {
      onSaveDraft(draftName.trim(), items);
      setDraftName('');
      setSaveDialogOpen(false);
    }
  };

  const handleLoadDraft = (draft: RascunhoCompra) => {
    onLoadDraft(draft);
    setLoadDialogOpen(false);
  };

  const handleCreateNew = () => {
    setLoadDialogOpen(false);
    setCreationMode('type');
    setCreateStepDialogOpen(true);
  };

  const handleStartFromScratch = () => {
    onCreateNew();
    setCreateStepDialogOpen(false);
    setDraftName(monthOptions[0].value);
    setSaveDialogOpen(true);
  };

  const handleBaseOnExisting = () => {
    setCreationMode('base');
  };

  const handleSelectBaseDraft = (draft: RascunhoCompra) => {
    onLoadDraftAsBase(draft);
    setCreateStepDialogOpen(false);
    setDraftName(monthOptions[0].value);
    setSaveDialogOpen(true);
  };

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
        disabled={isSaving}
        size="sm"
        variant={variant || "outline"}
        className={className}
      >
        <Save className="h-4 w-4 mr-1.5" />
        {currentDraft ? 'Salvar' : 'Salvar'}
      </Button>

      {(isMobileLayout || !className) && (
        <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className={className}>
              <FolderOpen className="h-4 w-4 mr-1.5" />
              Rascunhos
            </Button>
          </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecionar Mês ou Rascunho</DialogTitle>
            <DialogDescription>
              Escolha o rascunho mensal que deseja editar ou crie um novo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Button 
              onClick={handleCreateNew}
              className="w-full justify-start"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Novo Relatório
            </Button>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : drafts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum rascunho encontrado
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {drafts.map((draft) => (
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
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1">
                          <span>Criado por: {draft.criado_por?.nome || 'Usuário desconhecido'}</span>
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
                            <AlertDialogTitle>Excluir Rascunho</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir o rascunho "{draft.nome_rascunho}"? 
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
            <DialogTitle>Novo Pedido de Compras</DialogTitle>
            <DialogDescription>
              Como deseja iniciar este novo pedido?
            </DialogDescription>
          </DialogHeader>

          {creationMode === 'type' ? (
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
                disabled={drafts.length === 0}
              >
                <Copy className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <div className="font-semibold">Basear em Rascunho</div>
                  <div className="text-xs text-muted-foreground">Copia as quantidades de um pedido anterior</div>
                </div>
              </Button>
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
                <span>/ Selecionar rascunho base</span>
              </div>
              
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {drafts.map((draft) => (
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
            <DialogTitle>Salvar Rascunho</DialogTitle>
            <DialogDescription>
              Digite um nome para o rascunho do relatório de compras.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="draft-month">Selecione o Mês do Pedido</Label>
              <Select 
                value={draftName} 
                onValueChange={(value) => setDraftName(value)}
              >
                <SelectTrigger id="draft-month">
                  <SelectValue placeholder="Selecione um mês" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="draft-name">Nome do Rascunho (opcional para ajuste)</Label>
              <Input
                id="draft-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Ex: Relatório Janeiro 2024"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveNew}
              disabled={!draftName.trim() || isSaving}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}