
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PackagePlus, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ProductEntryFormFields } from './product-entry/ProductEntryFormFields';
import { RecentEntriesList } from './product-entry/RecentEntriesList';
import { useProductEntryQueries } from './product-entry/hooks/useProductEntryQueries';
import { useProductEntryMutations } from './product-entry/hooks/useProductEntryMutations';

export function ProductEntryForm() {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [lote, setLote] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [dataEntrada, setDataEntrada] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { user } = useAuth();
  const { produtos, entradas, isLoadingEntradas } = useProductEntryQueries();
  const { createEntryMutation, handleSubmit } = useProductEntryMutations();

  // Verificar se o usuário está autenticado
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você precisa estar logado para registrar entradas.</p>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setSelectedProduct('');
    setQuantidade('');
    setLote('');
    setVencimento('');
    setDataEntrada(format(new Date(), 'yyyy-MM-dd'));
  };

  const onSubmit = (e: React.FormEvent) => {
    handleSubmit(e, {
      selectedProduct,
      quantidade,
      lote,
      vencimento,
      dataEntrada
    }, resetForm);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PackagePlus className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Entrada de Produtos</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário de Entrada */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Registrar Nova Entrada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProductEntryFormFields
              selectedProduct={selectedProduct}
              setSelectedProduct={setSelectedProduct}
              quantidade={quantidade}
              setQuantidade={setQuantidade}
              lote={lote}
              setLote={setLote}
              vencimento={vencimento}
              setVencimento={setVencimento}
              dataEntrada={dataEntrada}
              setDataEntrada={setDataEntrada}
              produtos={produtos}
              onSubmit={onSubmit}
              isLoading={createEntryMutation.isPending}
            />
          </CardContent>
        </Card>

        {/* Lista de Entradas Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Entradas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentEntriesList
              entradas={entradas}
              isLoading={isLoadingEntradas}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
