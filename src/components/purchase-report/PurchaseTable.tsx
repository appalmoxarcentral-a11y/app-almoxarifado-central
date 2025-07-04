
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Package } from 'lucide-react';
import type { PurchaseItem } from '@/types/purchase';

interface PurchaseTableProps {
  items: PurchaseItem[];
  onQuantityChange: (productId: string, quantity: number | undefined) => void;
}

export function PurchaseTable({ items, onQuantityChange }: PurchaseTableProps) {
  const handleQuantityChange = (productId: string, value: string) => {
    const quantity = value === '' ? undefined : parseInt(value);
    if (quantity !== undefined && quantity < 0) return;
    onQuantityChange(productId, quantity);
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum produto encontrado com os filtros aplicados.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos para Reposição ({items.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Código</th>
                <th className="text-left p-2 font-medium">Descrição</th>
                <th className="text-center p-2 font-medium">Unidade</th>
                <th className="text-center p-2 font-medium">Estoque Atual</th>
                <th className="text-center p-2 font-medium">Qtd. Reposição</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 font-mono text-sm">{item.codigo}</td>
                  <td className="p-2">{item.descricao}</td>
                  <td className="p-2 text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {item.unidade_medida}
                    </span>
                  </td>
                  <td className="p-2 text-center">
                    <span className={`font-medium ${
                      item.estoque_atual <= 10 ? 'text-red-600' : 
                      item.estoque_atual <= 50 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {item.estoque_atual}
                    </span>
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={item.quantidade_reposicao || ''}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      className="w-20 text-center mx-auto"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
