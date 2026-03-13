
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Save, Plus, Edit, X, FileSpreadsheet, Settings } from "lucide-react";
import { Product } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionCheck } from "@/components/auth/PermissionCheck";
import { ExcelImportExport } from "@/components/excel/ExcelImportExport";
import { UnidadeMedidaManager } from "@/components/excel/UnidadeMedidaManager";
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
    if (user?.tipo !== 'ADMIN') {
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-2">
        <Package className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Cadastro de Produtos</h1>
          <p className="text-sm md:text-base text-muted-foreground">Gerencie o catálogo de produtos farmacêuticos</p>
        </div>
      </div>

      <Tabs defaultValue="manual" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 text-xs md:text-sm">
          <TabsTrigger value="manual">Cadastro Manual</TabsTrigger>
          <TabsTrigger value="excel">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importar Excel
          </TabsTrigger>
          <TabsTrigger value="units">
            <Settings className="h-4 w-4 mr-2" />
            Unidades de Medida
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-6">
          <Card ref={formRef}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editingProduct ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </CardTitle>
              <CardDescription>
                {editingProduct 
                  ? 'Atualize os dados do produto selecionado'
                  : 'Cadastre um novo produto no sistema farmacêutico'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <ProductFormFields
                  formData={formData}
                  onFormDataChange={setFormData}
                  unidadesMedida={unidadesMedida}
                  editingProductId={editingProduct?.id}
                />

                <div className="flex justify-end gap-4">
                  {editingProduct && (
                    <Button type="button" variant="outline" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  )}
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setFormData({ descricao: '', codigo: '', unidade_medida: '' })}
                  >
                    Limpar
                  </Button>
                  <Button type="submit" disabled={loading} className="flex items-center gap-2">
                    <Save className="h-4 w-4" />
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

        <TabsContent value="units">
          <UnidadeMedidaManager />
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
