
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PackagePlus, Package, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductEntryFormFields } from './product-entry/ProductEntryFormFields';
import { RecentEntriesList } from './product-entry/RecentEntriesList';
import { ExcelImportExport } from './excel/ExcelImportExport';
import { useProductEntryQueries } from './product-entry/hooks/useProductEntryQueries';
import { useProductEntryMutations } from './product-entry/hooks/useProductEntryMutations';

export function ProductEntryForm() {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [lote, setLote] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [dataEntrada, setDataEntrada] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { user } = useAuth();
  const { produtos } = useProductEntryQueries();
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

  const handleExcelSuccess = () => {
    // The RecentEntriesList will automatically refresh due to query invalidation
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-2">
        <PackagePlus className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Entrada de Produtos</h1>
          <p className="text-sm md:text-base text-muted-foreground">Registre a entrada de novos produtos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário de Entrada */}
        <Card>
          <CardHeader>
            <CardTitle>Registrar Entrada</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual">Entrada Manual</TabsTrigger>
                <TabsTrigger value="excel">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Importar Excel
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual">
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
              </TabsContent>

              <TabsContent value="excel">
                <ExcelImportExport mode="entries" onSuccess={handleExcelSuccess} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Lista de Entradas Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Entradas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentEntriesList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
