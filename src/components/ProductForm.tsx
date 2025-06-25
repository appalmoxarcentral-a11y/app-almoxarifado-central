
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UnidadeMedida, Product } from "@/types";

const unidadesMedida: { value: UnidadeMedida; label: string }[] = [
  { value: 'AM', label: 'Ampola (AM)' },
  { value: 'CP', label: 'Comprimido (CP)' },
  { value: 'BG', label: 'Bisnaga (BG)' },
  { value: 'FR', label: 'Frasco (FR)' },
  { value: 'CPS', label: 'Cápsula (CPS)' },
  { value: 'ML', label: 'Mililitro (ML)' },
  { value: 'MG', label: 'Miligrama (MG)' },
  { value: 'G', label: 'Grama (G)' },
  { value: 'KG', label: 'Quilograma (KG)' },
  { value: 'UN', label: 'Unidade (UN)' },
];

export function ProductForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState({
    descricao: '',
    codigo: '',
    unidade_medida: '' as UnidadeMedida,
  });

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast({
        title: "Erro ao carregar produtos",
        description: "Não foi possível carregar a lista de produtos.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (!formData.descricao || !formData.codigo || !formData.unidade_medida) {
        throw new Error('Todos os campos são obrigatórios');
      }

      const { error } = await supabase
        .from('produtos')
        .insert([{
          descricao: formData.descricao,
          codigo: formData.codigo.toUpperCase(),
          unidade_medida: formData.unidade_medida,
          estoque_atual: 0
        }]);

      if (error) throw error;
      
      toast({
        title: "Produto cadastrado com sucesso!",
        description: `${formData.descricao} foi adicionado ao sistema.`,
      });
      
      // Reset form
      setFormData({
        descricao: '',
        codigo: '',
        unidade_medida: '' as UnidadeMedida,
      });

      // Recarregar lista
      await loadProducts();
      
    } catch (error) {
      toast({
        title: "Erro ao cadastrar produto",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, descricao: string) => {
    if (!confirm(`Tem certeza que deseja excluir o produto ${descricao}?`)) return;

    try {
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Produto excluído",
        description: `${descricao} foi removido do sistema.`,
      });

      await loadProducts();
    } catch (error) {
      toast({
        title: "Erro ao excluir produto",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Novo Produto
          </CardTitle>
          <CardDescription>
            Cadastre um novo produto no sistema farmacêutico
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição do Produto *</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Dipirona 500mg"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo">Código do Produto *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                  placeholder="Ex: DIP500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidade_medida">Unidade de Medida *</Label>
                <Select 
                  value={formData.unidade_medida} 
                  onValueChange={(value: UnidadeMedida) => 
                    setFormData(prev => ({ ...prev, unidade_medida: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidadesMedida.map((unidade) => (
                      <SelectItem key={unidade.value} value={unidade.value}>
                        {unidade.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setFormData({ descricao: '', codigo: '', unidade_medida: '' as UnidadeMedida })}
              >
                Limpar
              </Button>
              <Button type="submit" disabled={loading} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {loading ? 'Salvando...' : 'Salvar Produto'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de produtos */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos Cadastrados ({products.length})</CardTitle>
          <CardDescription>Lista dos produtos no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {products.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum produto cadastrado.</p>
            ) : (
              products.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{product.descricao}</p>
                    <p className="text-sm text-gray-500">
                      Código: {product.codigo} | Unidade: {product.unidade_medida}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">Estoque: {product.estoque_atual}</p>
                      <p className="text-sm text-gray-500">unidades</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(product.id, product.descricao)}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
