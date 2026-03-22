
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Save, Plus, Edit, X, FileSpreadsheet, Settings } from "lucide-react";
import { Product } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionCheck } from "@/components/auth/PermissionCheck";
import { ExcelImportExport } from "@/components/excel/ExcelImportExport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductFormFields } from "@/components/product/ProductFormFields";
import { ProductList } from "@/components/product/ProductList";
import { useProductQueries } from "@/components/product/hooks/useProductQueries";
import { useProductMutations } from "@/components/product/hooks/useProductMutations";

export function ProductForm() {
  const { user, hasPermission } = useAuth();
  const formRef = useRef<HTMLDivElement>(null);

  if (!hasPermission('cadastro_produtos')) {
    return (
      <div className="p-8 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-20" />
        <h2 className="text-2xl font-bold text-muted-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground">Você não tem permissão para visualizar o cadastro de produtos.</p>
      </div>
    );
  }

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    descricao: '',
    codigo: '',
    unidade_medida: '',
  });

  const { 
    products, 
    totalProducts, 
    isSearching, 
    currentPage, 
    pageSize, 
    unidadesMedida, 
    loadProducts, 
    loadUnidadesMedida 
  } = useProductQueries();

  const { loading, submitForm, deleteProduct } = useProductMutations(() => {
    loadProducts(searchTerm, currentPage);
    setEditingProduct(null);
    setFormData({
      descricao: '',
      codigo: '',
      unidade_medida: '',
    });
  });

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(searchTerm, 1); // Ao buscar, volta para a página 1
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handlePageChange = (page: number) => {
    loadProducts(searchTerm, page);
    // Scroll suave para o topo da lista ao trocar de página
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (product: Product) => {
    if (user?.tipo !== 'ADMIN' && user?.tipo !== 'SUPER_ADMIN') {
      return;
    }
    
    setEditingProduct(product);
    setFormData({
      descricao: product.descricao,
      codigo: product.codigo,
      unidade_medida: product.unidade_medida,
    });

    // Scroll automático para o formulário de edição
    setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

  const handleCancelEdit = () => {
    setEditingProduct(null);
    setFormData({
      descricao: '',
      codigo: '',
      unidade_medida: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await submitForm(formData, editingProduct);
    if (success) {
      setFormData({
        descricao: '',
        codigo: '',
        unidade_medida: '',
      });
    }
  };

  const handleExcelSuccess = () => {
    loadProducts();
    loadUnidadesMedida();
  };

  return (
    <div className="space-y-6 md:space-y-10 pb-24 md:pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6 md:pb-8">
        <div className="flex items-center gap-3 md:gap-5">
          <div className="p-2.5 md:p-3 bg-primary/10 rounded-xl md:rounded-2xl shrink-0">
            <Package className="h-6 w-6 md:h-10 md:w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-5xl font-black tracking-tight text-foreground leading-tight">Cadastro de Produtos</h1>
            <p className="text-muted-foreground text-sm md:text-xl mt-0.5 md:mt-2 font-medium">Gerencie o catálogo de medicamentos</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="manual" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 h-12 md:h-14 bg-muted/50 p-1 rounded-xl md:rounded-2xl border border-border/50">
          <TabsTrigger value="manual" className="rounded-lg md:rounded-xl font-bold text-[10px] md:text-sm uppercase tracking-wider">Cadastro Manual</TabsTrigger>
          <TabsTrigger value="excel" className="rounded-lg md:rounded-xl font-bold text-[10px] md:text-sm uppercase tracking-wider">
            <FileSpreadsheet className="h-3.5 w-3.5 md:h-4 md:w-4 md:mr-2" />
            <span className="hidden xs:inline">Excel</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-6">
          <Card ref={formRef} className="border-border bg-card shadow-xl rounded-2xl md:rounded-3xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-primary/5 blur-3xl -mr-16 -mt-16 md:-mr-32 md:-mt-32" />
            
            <CardHeader className="p-5 md:p-8 relative">
              <CardTitle className="flex items-center gap-3 text-xl md:text-3xl font-black tracking-tighter">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {editingProduct ? <Edit className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                </div>
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </CardTitle>
              <CardDescription className="text-xs md:text-base font-medium mt-2">
                {editingProduct 
                  ? 'Atualize os dados do produto selecionado'
                  : 'Cadastre um novo produto no sistema farmacêutico'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 md:p-8 md:pt-0 relative">
              <form onSubmit={handleSubmit} className="space-y-8">
                <ProductFormFields
                  formData={formData}
                  onFormDataChange={setFormData}
                  unidadesMedida={unidadesMedida}
                  editingProductId={editingProduct?.id}
                  onUnitAdded={loadUnidadesMedida}
                />

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-border/50">
                  <div className="flex gap-3 w-full sm:w-auto">
                    {editingProduct && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit} className="flex-1 sm:flex-none h-12 md:h-14 px-6 rounded-xl font-bold border-border hover:bg-muted transition-all">
                        <X className="h-5 w-5 mr-2" />
                        Cancelar
                      </Button>
                    )}
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setFormData({ descricao: '', codigo: '', unidade_medida: '' })}
                      className="flex-1 sm:flex-none h-12 md:h-14 px-6 rounded-xl font-bold text-muted-foreground hover:text-foreground transition-all"
                    >
                      Limpar
                    </Button>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 md:h-14 px-8 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-none active:scale-95 transition-all">
                    <Save className="h-5 w-5 mr-2" />
                    {loading 
                      ? (editingProduct ? 'Atualizando...' : 'Salvando...') 
                      : (editingProduct ? 'Atualizar Produto' : 'Salvar Produto')
                    }
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="excel">
          <ExcelImportExport mode="products" onSuccess={handleExcelSuccess} />
        </TabsContent>
      </Tabs>

      <ProductList
        products={products}
        totalProducts={totalProducts}
        isSearching={isSearching}
        searchTerm={searchTerm}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onSearchChange={setSearchTerm}
        onEdit={handleEdit}
        onDelete={deleteProduct}
      />
    </div>
  );
}
