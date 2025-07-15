import React, { useState } from 'react';
import { Save, FolderOpen, Plus, Trash2 } from 'lucide-react';
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
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  onDeleteDraft: (draftId: string) => void;
  onCreateNew: () => void;
  getCurrentDraft: () => RascunhoCompra | undefined;
  items: PurchaseDraftItem[];
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
  onDeleteDraft,
  onCreateNew,
  getCurrentDraft,
  items
}: DraftManagerProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState('');

  const currentDraft = getCurrentDraft();

  const handleSave = () => {
    if (currentDraft) {
      // Atualizar rascunho existente
      onSaveDraft(currentDraft.nome_rascunho, items);
    } else {
      // Criar novo rascunho
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
    onCreateNew();
    setLoadDialogOpen(false);
  };

  const getItemsWithQuantity = (draftItems: PurchaseDraftItem[]) => {
    return draftItems.filter(item => item.quantidade_reposicao && item.quantidade_reposicao > 0).length;
  };

  return (
    <div className="flex items-center gap-2">
      {currentDraft && (
        <Badge variant="outline" className="text-xs">
          {currentDraft.nome_rascunho}
        </Badge>
      )}
      
      <Button
        onClick={handleSave}
        disabled={isSaving}
        size="sm"
        variant="outline"
      >
        <Save className="h-4 w-4 mr-2" />
        {currentDraft ? 'Salvar' : 'Salvar Como...'}
      </Button>

      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <FolderOpen className="h-4 w-4 mr-2" />
            Rascunhos
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Rascunhos</DialogTitle>
            <DialogDescription>
              Carregue um rascunho salvo ou crie um novo relatório.
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
              <Label htmlFor="draft-name">Nome do Rascunho</Label>
              <Input
                id="draft-name"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Ex: Relatório Janeiro 2024"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveNew();
                  }
                }}
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