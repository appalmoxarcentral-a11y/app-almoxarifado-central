
import React from 'react';
import { Package, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns/format';
import { ptBR } from 'date-fns/locale/pt-BR';
import type { Product } from '@/types';

interface LoteInfo {
  lote: string;
  vencimento: string;
  created_at: string;
}

interface ProductSelectionProps {
  selectedProduct: string;
  onProductChange: (productId: string) => void;
  selectedLote: string;
  setSelectedLote: (lote: string) => void;
  quantidade: string;
  setQuantidade: (quantidade: string) => void;
  produtos?: Product[];
  lotes?: LoteInfo[];
  onAddToCart: () => void;
  onSearchChange?: (value: string) => void;
}

export function ProductSelection({
  selectedProduct,
  onProductChange,
  selectedLote,
  setSelectedLote,
  quantidade,
  setQuantidade,
  produtos = [],
  lotes,
  onAddToCart,
  onSearchChange
}: ProductSelectionProps) {
  const produtoSelecionado = produtos.find(p => p.id === selectedProduct);

  const handleProductSelect = (product: Product) => {
    onProductChange(product.id);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          2. Adicionar Produtos ao Carrinho
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="produto">Produto *</Label>
            <SearchableSelect
              items={produtos}
              value={selectedProduct}
              onSelect={handleProductSelect}
              onSearchChange={onSearchChange}
              getItemValue={(product) => product.id}
              getItemLabel={(product) => `${product.descricao} (Estoque: ${product.estoque_atual} ${product.unidade_medida})`}
              getItemSearchText={(product) => `${product.descricao} ${product.codigo}`}
              placeholder="Selecione um produto"
              searchPlaceholder="Digite nome ou código do produto..."
              emptyMessage="Nenhum produto encontrado"
            />
          </div>

          {produtoSelecionado && (
            <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 shadow-sm transition-all animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 text-primary">
                <Package className="h-5 w-5" />
                <span className="font-semibold">Estoque Disponível</span>
              </div>
              <p className="text-foreground/90 mt-1 font-bold text-2xl">
                {produtoSelecionado.estoque_atual} <span className="text-lg font-medium text-muted-foreground">{produtoSelecionado.unidade_medida}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lote">Lote *</Label>
              <Select 
                value={selectedLote} 
                onValueChange={setSelectedLote}
                disabled={!selectedProduct}
              >
                <SelectTrigger>
                  <SelectValue 
                    placeholder={
                      !selectedProduct 
                        ? "Selecione um produto primeiro" 
                        : "Selecione um lote"
                    } 
                  />
                </SelectTrigger>
                <SelectContent>
                  {lotes?.map((loteInfo) => (
                    <SelectItem key={loteInfo.lote} value={loteInfo.lote}>
                      <div className="flex flex-col">
                        <span className="font-medium">{loteInfo.lote}</span>
                        <span className="text-xs text-gray-500">
                          Vence: {format(new Date(loteInfo.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProduct && lotes?.length === 0 && (
                <p className="text-sm text-yellow-600 mt-1">
                  Nenhum lote encontrado para este produto
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                max={produtoSelecionado?.estoque_atual || undefined}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={onAddToCart}
            disabled={!selectedProduct || !quantidade || !selectedLote}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar ao Carrinho
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
