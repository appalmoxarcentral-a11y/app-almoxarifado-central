
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Dispensation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface RecentDispensationsProps {
  dispensacoes?: Dispensation[];
  isLoading: boolean;
}

export function RecentDispensations({ dispensacoes, isLoading }: RecentDispensationsProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispensações Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">Carregando dispensações...</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {dispensacoes?.map((dispensacao) => (
              <div key={dispensacao.id} className="border rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{dispensacao.produto?.descricao}</p>
                      {isSuperAdmin && (
                        <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-600 px-1 py-0 h-4">
                          {(dispensacao as any).tenant?.name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      {dispensacao.paciente?.nome}
                    </p>
                    <p className="text-xs text-gray-600">
                      Lote: {dispensacao.lote} | Qtd: {dispensacao.quantidade} {dispensacao.produto?.unidade_medida}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {format(new Date(dispensacao.data_dispensa), 'dd/MM', { locale: ptBR })}
                  </Badge>
                </div>
              </div>
            ))}
            {(!dispensacoes || dispensacoes.length === 0) && (
              <p className="text-center text-gray-500 py-4">
                Nenhuma dispensação registrada ainda
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
