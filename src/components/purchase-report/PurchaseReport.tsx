
import React, { useEffect } from 'react';
import { ShoppingCart, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PurchaseFilters } from './PurchaseFilters';
import { PurchaseTable } from './PurchaseTable';
import { PurchasePDFGenerator } from './PurchasePDFGenerator';
import { DraftManager } from './DraftManager';
import { usePurchaseData } from './hooks/usePurchaseData';
import { usePurchaseState } from './hooks/usePurchaseState';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';

export function PurchaseReport() {
  const isMobile = useIsMobile();
  const { user, hasPermission } = useAuth();
  const { produtos, isLoading, error } = usePurchaseData();
  const {
    filteredItems,
    itemsForPDF,
    filters,
    setFilters,
    updatePurchaseQuantity,
    initializePurchaseItems,
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
  } = usePurchaseState();

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

  // Inicializar dados quando carregados
  useEffect(() => {
    if (produtos.length > 0) {
      initializePurchaseItems(produtos);
    }
  }, [produtos, initializePurchaseItems]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Erro ao carregar produtos: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isMobile && <ShoppingCart className="h-8 w-8 text-primary" />}
          <div>
            <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold`}>Relatório de Compras</h1>
            {!isMobile && <p className="text-gray-600">Gerencie as necessidades de reposição de produtos</p>}
          </div>
        </div>
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
                   <span className="truncate">{getCurrentDraft()?.nome_rascunho}</span>
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
                  className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-bold border-none shadow-sm text-[10px] px-2 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
