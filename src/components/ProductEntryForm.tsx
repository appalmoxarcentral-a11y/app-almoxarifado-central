
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PackagePlus, Package, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns/format';
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
  const [productSearch, setProductSearch] = useState('');

  const { user } = useAuth();
  const { produtos } = useProductEntryQueries({ productSearch });
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
    <div className="space-y-6 md:space-y-10 pb-24 md:pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6 md:pb-8">
        <div className="flex items-center gap-3 md:gap-5">
          <div className="p-2.5 md:p-3 bg-primary/10 rounded-xl md:rounded-2xl shrink-0">
            <PackagePlus className="h-6 w-6 md:h-10 md:w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-5xl font-black tracking-tight text-foreground leading-tight">Entrada de Produtos</h1>
            <p className="text-muted-foreground text-sm md:text-xl mt-0.5 md:mt-2 font-medium">Registre a entrada de novos medicamentos</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
        {/* Formulário de Entrada */}
        <Card className="border-border bg-card shadow-xl rounded-2xl md:rounded-3xl overflow-hidden relative h-fit">
          <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-primary/5 blur-3xl -mr-16 -mt-16 md:-mr-32 md:-mt-32" />
          
          <CardHeader className="p-5 md:p-8 relative">
            <CardTitle className="text-xl md:text-3xl font-black tracking-tighter">Registrar Entrada</CardTitle>
          </CardHeader>
          <CardContent className="p-5 md:p-8 md:pt-0 relative">
            <Tabs defaultValue="manual" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2 h-12 md:h-14 bg-muted/50 p-1 rounded-xl md:rounded-2xl border border-border/50">
                <TabsTrigger value="manual" className="rounded-lg md:rounded-xl font-bold text-[10px] md:text-sm uppercase tracking-wider">Entrada Manual</TabsTrigger>
                <TabsTrigger value="excel" className="rounded-lg md:rounded-xl font-bold text-[10px] md:text-sm uppercase tracking-wider">
                  <FileSpreadsheet className="h-4 w-4 md:mr-2" />
                  <span className="hidden xs:inline">Importar Excel</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="pt-2">
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
                  onSearchChange={setProductSearch}
                  onSubmit={onSubmit}
                  isLoading={createEntryMutation.isPending}
                />
              </TabsContent>

              <TabsContent value="excel" className="pt-2">
                <ExcelImportExport mode="entries" onSuccess={handleExcelSuccess} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Lista de Entradas Recentes */}
        <Card className="border-border bg-card shadow-xl rounded-2xl md:rounded-3xl overflow-hidden relative">
          <CardHeader className="p-5 md:p-8 relative border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl md:text-2xl font-black tracking-tight">Entradas Recentes</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 relative">
            <RecentEntriesList />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
