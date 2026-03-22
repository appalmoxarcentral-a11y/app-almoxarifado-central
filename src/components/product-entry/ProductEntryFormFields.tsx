
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableModal } from '@/components/ui/searchable-modal';
import { SmartDatePicker } from '@/components/ui/smart-date-picker';
import { Save, Package, Calendar as CalendarIcon } from 'lucide-react';
import type { Product } from '@/types';

interface ProductEntryFormFieldsProps {
  selectedProduct: string;
  setSelectedProduct: (value: string) => void;
  quantidade: string;
  setQuantidade: (value: string) => void;
  lote: string;
  setLote: (value: string) => void;
  vencimento: string;
  setVencimento: (value: string) => void;
  dataEntrada: string;
  setDataEntrada: (value: string) => void;
  produtos: Product[] | undefined;
  onSearchChange?: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function ProductEntryFormFields({
  selectedProduct,
  setSelectedProduct,
  quantidade,
  setQuantidade,
  lote,
  setLote,
  vencimento,
  setVencimento,
  dataEntrada,
  setDataEntrada,
  produtos,
  onSearchChange,
  onSubmit,
  isLoading
}: ProductEntryFormFieldsProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="produto" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Package className="h-3.5 w-3.5" />
          Produto *
        </Label>
        <SearchableModal
          items={produtos || []}
          value={selectedProduct}
          onSelect={(produto) => setSelectedProduct(produto.id)}
          onSearchChange={onSearchChange}
          getItemValue={(produto) => produto.id}
          getItemLabel={(produto) => `${produto.descricao} (${produto.codigo})`}
          getItemSearchText={(produto) => `${produto.descricao} ${produto.codigo}`}
          placeholder="Selecione um produto..."
          searchPlaceholder="Buscar por nome ou código..."
          emptyMessage="Nenhum produto encontrado"
          title="Selecionar Produto"
          className="h-12 text-[16px] rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantidade" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantidade *</Label>
          <Input
            id="quantidade"
            type="number"
            min="1"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="0"
            className="h-12 text-[16px] rounded-xl border-border bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lote" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lote *</Label>
          <Input
            id="lote"
            value={lote}
            onChange={(e) => setLote(e.target.value)}
            placeholder="Ex: LOT001"
            className="h-12 text-[16px] rounded-xl border-border bg-background"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="vencimento" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5" />
            Vencimento *
          </Label>
          <SmartDatePicker
            id="vencimento"
            value={vencimento}
            onChange={setVencimento}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataEntrada" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5" />
            Entrada
          </Label>
          <SmartDatePicker
            id="dataEntrada"
            value={dataEntrada}
            onChange={setDataEntrada}
            className="w-full"
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-14 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-none active:scale-[0.98] transition-all duration-300"
        disabled={isLoading}
      >
        <Save className="h-5 w-5 mr-2" />
        {isLoading ? 'Registrando...' : 'Registrar Entrada'}
      </Button>
    </form>
  );
}
