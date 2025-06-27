
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types';

interface CarrinhoItem {
  produto: Product;
  quantidade: number;
  lote: string;
}

interface ProductCartItemProps {
  item: CarrinhoItem;
  index: number;
  onRemove: (index: number) => void;
}

export function ProductCartItem({ item, index, onRemove }: ProductCartItemProps) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-medium text-sm">{item.produto.descricao}</p>
          <p className="text-xs text-gray-600">
            Lote: {item.lote}
          </p>
          <p className="text-xs text-gray-600">
            Qtd: {item.quantidade} {item.produto.unidade_medida}
          </p>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onRemove(index)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
