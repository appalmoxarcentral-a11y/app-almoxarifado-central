
import React, { useEffect, useState } from 'react';
import { ShoppingCart, Calendar, Package, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PurchaseFilters } from './PurchaseFilters';
import { PurchaseTable } from './PurchaseTable';
import { PurchasePDFGenerator } from './PurchasePDFGenerator';
import { DraftManager } from './DraftManager';
import { usePurchaseData } from './hooks/usePurchaseData';
import { usePurchaseState } from './hooks/usePurchaseState';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

import { PaymentCelebration } from '../subscription/PaymentCelebration';
import { addDays, isAfter, format } from 'date-fns';

export function PurchaseReport() {
  const isMobile = useIsMobile();
  const { user, hasPermission } = useAuth();
  const {
    purchaseItems,
    filteredItems,
    itemsForPDF,
    filters,
    setFilters,
    updatePurchaseQuantity,
    // Draft management
    drafts,
    currentDraftId,
    isLoading: isDraftsLoading,
    isSaving,
    canEditDraft,
    canDeleteDraft,
    saveDraft,
    loadDraft,
    loadDraftAsBase,
    deleteDraft,
    createNewDraft,
    getCurrentDraft,
    draftItems,
    authorizeDraft,
    confirmDelivery,
    hasChanges
  } = usePurchaseState();

  const currentDraft = getCurrentDraft();
  const canAuthorize = hasPermission('acesso_global_pedidos');

  const handleAuthorize = () => {
    if (currentDraft?.id) {
      authorizeDraft.mutate(currentDraft.id);
    }
  };

  const handleConfirmDelivery = () => {
    if (currentDraft?.id) {
      confirmDelivery.mutate(currentDraft.id);
    }
  };

  const isAuthorized = currentDraft?.status === 'autorizado';
  const isEntregue = currentDraft?.status === 'entregue';

  // Lógica de animação e prazos
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationType, setCelebrationType] = useState<'autorizado' | 'entregue'>('autorizado');

  useEffect(() => {
    if (currentDraft?.status === 'autorizado' || currentDraft?.status === 'entregue') {
      const lastUpdate = new Date(currentDraft.data_atualizacao);
      const now = new Date();
      // Mostrar animação se foi atualizado nos últimos 10 segundos (para pegar a mudança em tempo real)
      if (now.getTime() - lastUpdate.getTime() < 10000) {
        setCelebrationType(currentDraft.status as any);
        setShowCelebration(true);
      }
    }
  }, [currentDraft?.status, currentDraft?.id]);

  // Verificar se o usuário tem permissão para relatório de compras
  if (!hasPermission('relatorio_compras')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Restrito</h2>
          <p className="text-gray-600">
            Você não tem permissão para acessar o relatório de compras.
          </p>
        </div>
      </div>
    );
  }

  // O carregamento agora é gerenciado internamente pelo usePurchaseState
  const isLoading = isDraftsLoading && purchaseItems.length === 0;

  return (
    <div className="space-y-6">
      {showCelebration && (
        <PaymentCelebration 
          type={celebrationType === 'autorizado' ? 'success' : 'subscription'}
          onComplete={() => setShowCelebration(false)}
        />
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isMobile && <ShoppingCart className="h-8 w-8 text-primary" />}
          <div>
            <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold`}>Relatório de Compras</h1>
            {!isMobile && <p className="text-gray-600">Gerencie as necessidades de reposição de produtos</p>}
          </div>
        </div>
        {/* Adicionar botão de Pedidos no topo para desktop quando não houver itens selecionados */}
        {!isMobile && itemsForPDF.length === 0 && (
          <DraftManager
            drafts={drafts}
            currentDraftId={currentDraftId}
            isLoading={isDraftsLoading}
            isSaving={isSaving}
            canEditDraft={canEditDraft}
            canDeleteDraft={canDeleteDraft}
            onSaveDraft={saveDraft}
            onLoadDraft={loadDraft}
            onLoadDraftAsBase={loadDraftAsBase}
            onDeleteDraft={deleteDraft}
            onCreateNew={createNewDraft}
            getCurrentDraft={getCurrentDraft}
            items={draftItems}
          />
        )}
      </div>

      {isMobile && itemsForPDF.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-orange-900/10 border border-orange-500/20 rounded-xl space-y-1">
            <div className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Produtos em Reposição</div>
            <div className="text-3xl font-black text-foreground">{itemsForPDF.length}</div>
          </div>
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-1">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total de Unidades</div>
            <div className="text-3xl font-black text-foreground">
              {itemsForPDF.reduce((sum, item) => sum + (item.quantidade_reposicao || 0), 0)}
            </div>
          </div>
        </div>
      )}

      {/* Alerta de Autorização e Prazo */}
      {isAuthorized && !isEntregue && (
        <div className="bg-green-600/10 border-2 border-green-600/20 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in duration-500">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="h-12 w-12 bg-green-600 rounded-full flex items-center justify-center shrink-0">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-green-700">Pedido Autorizado!</h3>
              <p className="text-sm text-green-600 font-medium">
                O estoque será atualizado automaticamente assim que a entrega for confirmada pelo Almoxarifado.
              </p>
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-white/50 rounded-full text-xs font-bold text-green-800 border border-green-200">
                <span className="uppercase tracking-wider">Prazo Máximo para Retirada:</span>
                <span>{format(addDays(new Date(currentDraft?.data_autorizacao || new Date()), 7), 'dd/MM/yyyy')}</span>
              </div>
            </div>
          </div>
          
          {canAuthorize && (
            <Button 
              onClick={handleConfirmDelivery}
              className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-8 rounded-xl shadow-lg shadow-green-600/20 w-full md:w-auto"
              disabled={confirmDelivery.isPending}
            >
              {confirmDelivery.isPending ? 'Processando...' : 'Confirmar Entrega'}
            </Button>
          )}
        </div>
      )}

      {isEntregue && (
        <div className="bg-blue-600/10 border-2 border-blue-600/20 rounded-2xl p-4 md:p-6 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
            <Package className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-blue-700">Pedido Entregue e Finalizado</h3>
            <p className="text-sm text-blue-600 font-medium">
              Os itens foram incorporados ao estoque da unidade em {format(new Date(currentDraft?.data_entrega || new Date()), 'dd/MM/yyyy HH:mm')}.
            </p>
          </div>
        </div>
      )}

      {!isAuthorized && !isEntregue && canAuthorize && currentDraft?.id && itemsForPDF.length > 0 && (
        <div className="bg-primary/5 border-2 border-primary/10 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <div>
              <p className="font-bold text-primary">Gestão de Pedido</p>
              <p className="text-xs text-muted-foreground">Você tem permissão para autorizar este pedido de reposição.</p>
            </div>
          </div>
          <Button 
            onClick={handleAuthorize}
            className="bg-primary hover:bg-primary/90 text-white font-black h-12 px-10 rounded-xl shadow-xl w-full md:w-auto"
            disabled={authorizeDraft.isPending}
          >
            {authorizeDraft.isPending ? 'Autorizando...' : 'Autorizar Pedido'}
          </Button>
        </div>
      )}

      <PurchaseFilters 
        filters={filters}
        onFiltersChange={setFilters}
      />

      {!isMobile && itemsForPDF.length > 0 && (
        <div className="sticky top-[73px] z-50 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Card className="shadow-lg border-primary/20">
            <CardHeader className="py-3">
              <CardTitle className="text-green-700 text-lg flex items-center gap-2">
                ✓ {itemsForPDF.length} {itemsForPDF.length === 1 ? 'produto selecionado' : 'produtos selecionados'} para compra
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">
                    {itemsForPDF.length}
                  </div>
                  <div className="text-xs text-blue-600 font-medium">Produtos</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-xl font-bold text-green-600">
                    {itemsForPDF.reduce((sum, item) => sum + (item.quantidade_reposicao || 0), 0)}
                  </div>
                  <div className="text-xs text-green-600 font-medium">Total de Unidades</div>
                </div>
                <div className="flex items-center justify-center">
                  <DraftManager
                    drafts={drafts}
                    currentDraftId={currentDraftId}
                    isLoading={isDraftsLoading}
                    isSaving={isSaving}
                    canEditDraft={canEditDraft}
                    canDeleteDraft={canDeleteDraft}
                    onSaveDraft={saveDraft}
                    onLoadDraft={loadDraft}
                    onLoadDraftAsBase={loadDraftAsBase}
                    onDeleteDraft={deleteDraft}
                    onCreateNew={createNewDraft}
                    getCurrentDraft={getCurrentDraft}
                    items={draftItems}
                  />
                </div>
                <div className="flex items-center justify-center">
                  <PurchasePDFGenerator items={itemsForPDF} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <PurchaseTable
        items={filteredItems}
        onQuantityChange={updatePurchaseQuantity}
      />

      {isMobile && itemsForPDF.length > 0 && (
        <div className="fixed bottom-[72px] left-0 right-0 z-50 px-2 py-3 bg-background/95 backdrop-blur-md border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
          <div className="flex flex-col gap-3 max-w-md mx-auto">
            {currentDraftId && (
               <div className="flex justify-center">
                 <div className="max-w-[80%] px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2">
                   <Calendar className="h-3 w-3 shrink-0" />
                   <span className="truncate">{getCurrentDraft()?.nome_rascunho} ({getCurrentDraft()?.unidade_nome})</span>
                 </div>
               </div>
             )}
            
            <div className="grid grid-cols-3 gap-1.5 px-1">
              <div className="col-span-1">
                <PurchasePDFGenerator 
                  items={itemsForPDF} 
                  className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold border-none shadow-sm text-[10px] px-2 rounded-lg"
                />
              </div>
              
              <div className="col-span-2">
                <DraftManager
                  drafts={drafts}
                  currentDraftId={currentDraftId}
                  isLoading={isDraftsLoading}
                  isSaving={isSaving}
                  canEditDraft={canEditDraft}
                  canDeleteDraft={canDeleteDraft}
                  onSaveDraft={saveDraft}
                  onLoadDraft={loadDraft}
                  onLoadDraftAsBase={loadDraftAsBase}
                  onDeleteDraft={deleteDraft}
                  onCreateNew={createNewDraft}
                  getCurrentDraft={getCurrentDraft}
                  items={draftItems}
                  className="h-9 font-bold text-[10px] px-2 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
