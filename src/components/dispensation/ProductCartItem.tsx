
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/types';

interface CarrinhoItem {
  produto: Product;
  quantidade: number;
  lote: string;
  is_parcial: boolean;
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
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-gray-600">
              Qtd: {item.quantidade} {item.produto.unidade_medida}
            </p>
            {item.is_parcial && (
              <Badge variant="outline" className="text-[9px] h-4 py-0 border-amber-500 text-amber-500 bg-amber-500/5">
                Parcial
              </Badge>
            )}
          </div>
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
