
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save } from 'lucide-react';
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
  onSubmit,
  isLoading
}: ProductEntryFormFieldsProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="produto">Produto *</Label>
        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um produto" />
          </SelectTrigger>
          <SelectContent>
            {produtos?.map((produto) => (
              <SelectItem key={produto.id} value={produto.id}>
                {produto.descricao} ({produto.codigo})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quantidade">Quantidade *</Label>
          <Input
            id="quantidade"
            type="number"
            min="1"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="lote">Lote *</Label>
          <Input
            id="lote"
            value={lote}
            onChange={(e) => setLote(e.target.value)}
            placeholder="Ex: LOT001"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="vencimento">Data de Vencimento *</Label>
          <Input
            id="vencimento"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="dataEntrada">Data de Entrada</Label>
          <Input
            id="dataEntrada"
            type="date"
            value={dataEntrada}
            onChange={(e) => setDataEntrada(e.target.value)}
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading}
      >
        {isLoading ? 'Registrando...' : 'Registrar Entrada'}
      </Button>
    </form>
  );
}
