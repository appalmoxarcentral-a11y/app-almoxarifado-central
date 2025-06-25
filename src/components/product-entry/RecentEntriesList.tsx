
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ProductEntry } from '@/types';

interface RecentEntriesListProps {
  entradas: ProductEntry[] | undefined;
  isLoading: boolean;
}

export function RecentEntriesList({ entradas, isLoading }: RecentEntriesListProps) {
  if (isLoading) {
    return <div className="text-center py-4">Carregando entradas...</div>;
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {entradas?.map((entrada) => (
        <div key={entrada.id} className="border rounded-lg p-3">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{entrada.produto?.descricao}</p>
              <p className="text-sm text-gray-600">
                Lote: {entrada.lote} | Qtd: {entrada.quantidade} {entrada.produto?.unidade_medida}
              </p>
              <p className="text-xs text-gray-500">
                Venc: {format(new Date(entrada.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
            </div>
            <Badge variant="secondary">
              {format(new Date(entrada.data_entrada), 'dd/MM', { locale: ptBR })}
            </Badge>
          </div>
        </div>
      ))}
      {(!entradas || entradas.length === 0) && (
        <p className="text-center text-gray-500 py-4">
          Nenhuma entrada registrada ainda
        </p>
      )}
    </div>
  );
}
