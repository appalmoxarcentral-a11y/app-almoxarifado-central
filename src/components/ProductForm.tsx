
import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Save, Plus, Edit, X, FileSpreadsheet, Settings } from "lucide-react";
import { UnidadeMedida, Product } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { ExcelImportExport } from "@/components/excel/ExcelImportExport";
import { UnidadeMedidaManager } from "@/components/excel/UnidadeMedidaManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductFormFields } from "@/components/product/ProductFormFields";
import { ProductList } from "@/components/product/ProductList";
import { useProductQueries } from "@/components/product/hooks/useProductQueries";
import { useProductMutations } from "@/components/product/hooks/useProductMutations";

export function ProductForm() {
  const { user } = useAuth();
  const formRef = useRef<HTMLDivElement>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    descricao: '',
    codigo: '',
    unidade_medida: '' as UnidadeMedida,
  });

  const { products, unidadesMedida, loadProducts, loadUnidadesMedida } = useProductQueries();
  const { loading, submitForm, deleteProduct } = useProductMutations(() => {
    loadProducts();
    setEditingProduct(null);
    setFormData({
      descricao: '',
      codigo: '',
      unidade_medida: '' as UnidadeMedida,
    });
  });

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
      unidade_medida: '' as UnidadeMedida,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await submitForm(formData, editingProduct);
    if (success) {
      setFormData({
        descricao: '',
        codigo: '',
        unidade_medida: '' as UnidadeMedida,
      });
    }
  };

  const handleExcelSuccess = () => {
    loadProducts();
    loadUnidadesMedida();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Package className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cadastro de Produtos</h1>
          <p className="text-gray-600">Gerencie o catálogo de produtos farmacêuticos</p>
        </div>
      </div>

      <Tabs defaultValue="manual" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
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
                    onClick={() => setFormData({ descricao: '', codigo: '', unidade_medida: '' as UnidadeMedida })}
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
        onEdit={handleEdit}
        onDelete={deleteProduct}
      />
    </div>
  );
}
