
import React, { useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PurchaseFilters } from './PurchaseFilters';
import { PurchaseTable } from './PurchaseTable';
import { PurchasePDFGenerator } from './PurchasePDFGenerator';
import { usePurchaseData } from './hooks/usePurchaseData';
import { usePurchaseState } from './hooks/usePurchaseState';
import { useAuth } from '@/contexts/AuthContext';

export function PurchaseReport() {
  const { user } = useAuth();
  const { produtos, isLoading, error } = usePurchaseData();
  const {
    filteredItems,
    itemsForPDF,
    filters,
    setFilters,
    updatePurchaseQuantity,
    initializePurchaseItems
  } = usePurchaseState();

  // Verificar se o usuário é administrador
  if (user?.tipo !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Restrito</h2>
          <p className="text-gray-600">
            Apenas administradores podem acessar o relatório de compras.
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
          <ShoppingCart className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Relatório de Compras</h1>
            <p className="text-gray-600">Gerencie as necessidades de reposição de produtos</p>
          </div>
        </div>
        
        <PurchasePDFGenerator items={itemsForPDF} />
      </div>

      <PurchaseFilters 
        filters={filters}
        onFiltersChange={setFilters}
      />

      {itemsForPDF.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">
              ✓ {itemsForPDF.length} {itemsForPDF.length === 1 ? 'produto selecionado' : 'produtos selecionados'} para compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {itemsForPDF.length}
                </div>
                <div className="text-sm text-blue-600">Produtos</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {itemsForPDF.reduce((sum, item) => sum + (item.quantidade_reposicao || 0), 0)}
                </div>
                <div className="text-sm text-green-600">Total de Unidades</div>
              </div>
              <div className="flex items-center justify-center">
                <PurchasePDFGenerator items={itemsForPDF} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <PurchaseTable
        items={filteredItems}
        onQuantityChange={updatePurchaseQuantity}
      />
    </div>
  );
}
