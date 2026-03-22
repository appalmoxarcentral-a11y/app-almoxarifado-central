
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Package, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface HistoryStatsProps {
  totalEntradas: number;
  totalDispensacoes: number;
  totalProdutos: number;
  movimentacoesHoje: number;
}

export function HistoryStats({
  totalEntradas,
  totalDispensacoes,
  totalProdutos,
  movimentacoesHoje
}: HistoryStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Entradas</p>
              <p className="text-lg md:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalEntradas}</p>
              <Badge variant="secondary" className="bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 text-[10px] h-5 px-1.5 font-bold uppercase mt-1">
                entrou
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Dispensações</p>
              <p className="text-lg md:text-2xl font-bold text-destructive">{totalDispensacoes}</p>
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5 font-bold uppercase mt-1">
                saiu
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <Package className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Produtos</p>
              <p className="text-lg md:text-2xl font-bold text-blue-600 dark:text-blue-400">{totalProdutos}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <Calendar className="h-4 w-4 md:h-5 md:w-5 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-xs md:text-sm text-muted-foreground">Hoje</p>
              <p className="text-lg md:text-2xl font-bold text-purple-600 dark:text-purple-400">
                {movimentacoesHoje}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
