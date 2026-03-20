
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
          <ShoppingCart className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-primary`} />
          <div>
            <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold`}>Pedidos</h1>
            <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600`}>Gerencie as necessidades de reposição de produtos</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <PurchaseFilters 
          filters={filters}
          onFiltersChange={setFilters}
          showOnlyLowStock
        />

        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
          <div className={`text-center p-3 rounded-xl min-w-[120px] transition-colors ${itemsForPDF.length > 0 ? 'bg-blue-600/10 border border-blue-600/20' : 'bg-muted/50 border border-muted/10'}`}>
            <div className={`text-2xl font-black ${itemsForPDF.length > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
              {itemsForPDF.length}
            </div>
            <div className={`text-[10px] uppercase font-bold tracking-wider ${itemsForPDF.length > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>Produtos</div>
          </div>
          <div className={`text-center p-3 rounded-xl min-w-[120px] transition-colors ${itemsForPDF.length > 0 ? 'bg-green-600/10 border border-green-600/20' : 'bg-muted/50 border border-muted/10'}`}>
            <div className={`text-2xl font-black ${itemsForPDF.length > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
              {itemsForPDF.reduce((sum, item) => sum + (item.quantidade_reposicao || 0), 0)}
            </div>
            <div className={`text-[10px] uppercase font-bold tracking-wider ${itemsForPDF.length > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>Total Unidades</div>
          </div>
        </div>
      </div>

      <div className="sticky top-[52px] z-50 bg-background/95 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 shadow-md border-b md:top-[64px] md:-mx-6 md:px-6">
        <div className="space-y-4">
          <PurchaseFilters 
            filters={filters}
            onFiltersChange={setFilters}
            showOnlySearch
          />

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 w-full md:w-auto flex-1">
            {currentDraftId && (
              <div className="w-full md:w-auto flex justify-center md:justify-end mb-1 md:mb-0 md:mr-2">
                <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary flex items-center gap-1.5 shadow-sm backdrop-blur-sm">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-[250px] md:max-w-[400px] flex items-center gap-1.5">
                    {currentDraft?.nome_rascunho}
                    {currentDraft?.unidade_nome && (
                      <>
                        <span className="opacity-30">|</span>
                        <span className="uppercase text-primary/80 tracking-tight">{currentDraft.unidade_nome}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 md:flex gap-2 w-full md:w-auto">
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
                  className="w-full h-11 md:h-10 font-bold shadow-sm"
                  hasChanges={hasChanges}
                />
              </div>
              <div className="col-span-1">
                <PurchasePDFGenerator 
                  items={itemsForPDF} 
                  className="w-full h-11 md:h-10 bg-primary hover:bg-primary/90 text-white font-black shadow-lg rounded-xl transition-all active:scale-95"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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

      <PurchaseTable
        items={filteredItems}
        onQuantityChange={updatePurchaseQuantity}
      />
    </div>
  );
}
