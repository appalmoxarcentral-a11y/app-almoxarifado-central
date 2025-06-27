
import React from 'react';
import { Package, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
}

export function ProductSelection({
  selectedProduct,
  onProductChange,
  selectedLote,
  setSelectedLote,
  quantidade,
  setQuantidade,
  produtos,
  lotes,
  onAddToCart
}: ProductSelectionProps) {
  const produtoSelecionado = produtos?.find(p => p.id === selectedProduct);

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
            <Select value={selectedProduct} onValueChange={onProductChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto" />
              </SelectTrigger>
              <SelectContent>
                {produtos?.map((produto) => (
                  <SelectItem key={produto.id} value={produto.id}>
                    {produto.descricao} (Estoque: {produto.estoque_atual} {produto.unidade_medida})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {produtoSelecionado && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <Package className="h-4 w-4" />
                <span className="font-medium">Estoque Disponível</span>
              </div>
              <p className="text-blue-600 mt-1">
                {produtoSelecionado.estoque_atual} {produtoSelecionado.unidade_medida}
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
