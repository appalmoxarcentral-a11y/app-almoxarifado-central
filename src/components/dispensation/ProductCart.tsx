
import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProductCartItem } from './ProductCartItem';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Product } from '@/types';

interface CarrinhoItem {
  produto: Product;
  quantidade: number;
  lote: string;
  is_parcial: boolean;
}

interface ProductCartProps {
  carrinho: CarrinhoItem[];
  onRemoveItem: (index: number) => void;
  onConfirmDispensation: () => void;
  selectedPatient: string;
  isProcessing: boolean;
}

export function ProductCart({
  carrinho,
  onRemoveItem,
  onConfirmDispensation,
  selectedPatient,
  isProcessing
}: ProductCartProps) {
  const totalItensCarrinho = carrinho.reduce((total, item) => total + item.quantidade, 0);
  const isMobile = useIsMobile();

  // When used inside mobile Sheet, render without Card wrapper
  if (isMobile) {
    return (
      <div>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {carrinho.map((item, index) => (
            <ProductCartItem
              key={index}
              item={item}
              index={index}
              onRemove={onRemoveItem}
            />
          ))}
          {carrinho.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Carrinho vazio
            </p>
          )}
        </div>

        {carrinho.length > 0 && (
          <Button
            className="w-full mt-4"
            onClick={onConfirmDispensation}
            disabled={isProcessing || !selectedPatient}
          >
            {isProcessing 
              ? 'Processando...' 
              : `Confirmar Dispensação (${carrinho.length} produtos)`
            }
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Carrinho ({totalItensCarrinho} itens)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {carrinho.map((item, index) => (
            <ProductCartItem
              key={index}
              item={item}
              index={index}
              onRemove={onRemoveItem}
            />
          ))}
          {carrinho.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Carrinho vazio
            </p>
          )}
        </div>

        {carrinho.length > 0 && (
          <Button
            className="w-full mt-4"
            onClick={onConfirmDispensation}
            disabled={isProcessing || !selectedPatient}
          >
            {isProcessing 
              ? 'Processando...' 
              : `Confirmar Dispensação (${carrinho.length} produtos)`
            }
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
