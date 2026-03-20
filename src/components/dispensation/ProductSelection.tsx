
import React from 'react';
import { Package, Hash, Calculator, Plus, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns/format';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Product } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { useAuth } from '@/contexts/AuthContext';

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
  isParcial: boolean;
  setIsParcial: (value: boolean) => void;
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
  isParcial,
  setIsParcial,
  produtos = [],
  lotes,
  onAddToCart,
  onSearchChange
}: ProductSelectionProps) {
  const { user } = useAuth();
  const showExtraFields = user?.usar_tipo_dispensacao || user?.permissoes?.usar_tipo_dispensacao;
  const produtoSelecionado = produtos.find(p => p.id === selectedProduct);

  const handleProductSelect = (product: Product) => {
    onProductChange(product.id);
  };

  const formatVencimento = (vencimento: string) => {
    try {
      const date = new Date(vencimento + 'T12:00:00');
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch (e) {
      return vencimento;
    }
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
          <div className="space-y-2">
            <Label htmlFor="produto" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              Produto *
            </Label>
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
              className="h-12 text-[16px] rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20"
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

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-6 space-y-2">
              <Label htmlFor="lote" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Lote *
              </Label>
              <Select 
                value={selectedLote} 
                onValueChange={setSelectedLote}
                disabled={!selectedProduct}
              >
                <SelectTrigger className="h-12 rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20">
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
                          Vence: {formatVencimento(loteInfo.vencimento)}
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
            
            <div className={cn("space-y-2", showExtraFields ? "md:col-span-3" : "md:col-span-6")}>
              <Label htmlFor="quantidade" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Quantidade *
              </Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                max={produtoSelecionado?.estoque_atual || undefined}
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0"
                className="h-12 text-[16px] rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {showExtraFields && (
              <div className="md:col-span-3 space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  Tipo Entrega
                </Label>
                <button
                  type="button"
                  onClick={() => setIsParcial(!isParcial)}
                  className={cn(
                    "w-full h-12 rounded-xl border-2 transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden relative group",
                    isParcial 
                      ? "border-amber-500 bg-amber-500/10 text-amber-500" 
                      : "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                  )}
                >
                  <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-[10px] animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {isParcial ? (
                      <>
                        <AlertCircle className="h-4 w-4" />
                        Parcial
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Total
                      </>
                    )}
                  </div>
                  
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                </button>
              </div>
            )}
          </div>

          <Button
            type="button"
            className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-[0.98]"
            onClick={onAddToCart}
            disabled={!selectedProduct || !quantidade || !selectedLote}
          >
            <Plus className="h-5 w-5 mr-2" />
            Adicionar ao Carrinho
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
