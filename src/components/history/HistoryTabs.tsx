
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns/format';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAuth } from '@/contexts/AuthContext';
import { 
  StockOnlyTable, 
  PatientDispensationView, 
  ProductDispensationView, 
  EntriesOnlyView 
} from './index';

interface MovimentacaoType {
  id: string;
  tipo: 'entrada' | 'dispensacao';
  data: string;
  descricao_produto: string;
  quantidade: number;
  lote: string;
  paciente: string | null;
  tenant_name?: string;
  created_at?: string;
}

interface HistoryTabsProps {
  filtroTipo: string;
  buscaDinamica: string;
  filtroDataInicial: string;
  filtroDataFinal: string;
  filtroProduto: string;
  movimentacoes: MovimentacaoType[];
  logs?: Array<{
    id: string;
    acao: string;
    tabela: string;
    detalhes?: any;
    created_at?: string;
  }>;
}

export function HistoryTabs({
  filtroTipo,
  buscaDinamica,
  filtroDataInicial,
  filtroDataFinal,
  filtroProduto,
  movimentacoes,
  logs
}: HistoryTabsProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';

  // Função para renderizar conteúdo baseado no tipo
  const renderContent = () => {
    switch (filtroTipo) {
      case 'apenas-estoque':
        return <StockOnlyTable />;
      
      case 'entradas':
        return (
          <EntriesOnlyView
            searchTerm={buscaDinamica}
            filtroDataInicial={filtroDataInicial}
            filtroDataFinal={filtroDataFinal}
            filtroProduto={filtroProduto}
          />
        );
      
      case 'dispensacoes-pacientes':
        return <PatientDispensationView searchTerm={buscaDinamica} />;
      
      case 'dispensacoes-produtos':
        return (
          <ProductDispensationView
            searchTerm={buscaDinamica}
            filtroDataInicial={filtroDataInicial}
            filtroDataFinal={filtroDataFinal}
            filtroProduto={filtroProduto}
          />
        );
      
      default:
        // Mostrar todas as movimentações
        return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Data</TableHead>
                {isSuperAdmin && <TableHead className="min-w-[150px]">Unidade</TableHead>}
                <TableHead className="min-w-[120px]">Tipo</TableHead>
                <TableHead className="min-w-[150px]">Produto</TableHead>
                <TableHead className="min-w-[80px]">Qtd</TableHead>
                <TableHead className="min-w-[100px]">Lote</TableHead>
                <TableHead className="min-w-[120px]">Paciente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimentacoes.map((mov, index) => (
                <TableRow key={`${mov.tipo}-${mov.id}-${index}`}>
                  <TableCell className="text-xs md:text-sm">
                    {format(new Date(mov.data), 'dd/MM/yy', { locale: ptBR })}
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-xs font-medium text-blue-600">
                      {mov.tenant_name}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={mov.tipo === 'entrada' ? 'default' : 'secondary'} className="text-xs">
                      {mov.tipo === 'entrada' ? (
                        <><TrendingUp className="h-3 w-3 mr-1" /> Entrada</>
                      ) : (
                        <><TrendingDown className="h-3 w-3 mr-1" /> Dispensação</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs md:text-sm max-w-[150px] truncate">
                    {mov.descricao_produto}
                  </TableCell>
                  <TableCell className="text-xs md:text-sm">{mov.quantidade}</TableCell>
                  <TableCell className="text-xs md:text-sm">{mov.lote}</TableCell>
                  <TableCell className="text-xs md:text-sm max-w-[120px] truncate">
                    {mov.paciente || '-'}
                  </TableCell>
                </TableRow>
              ))}
              {movimentacoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isSuperAdmin ? 7 : 6} className="text-center py-8 text-gray-500">
                    Nenhuma movimentação encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        );
    }
  };

  return (
    <Tabs defaultValue="movimentacoes" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 h-12">
        <TabsTrigger value="movimentacoes" className="text-sm">Movimentações</TabsTrigger>
        <TabsTrigger value="logs" className="text-sm">Logs</TabsTrigger>
      </TabsList>

      <TabsContent value="movimentacoes">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">
              {filtroTipo === 'apenas-estoque' ? 'Produtos em Estoque' : 
               filtroTipo === 'dispensacoes-pacientes' ? 'Dispensações por Paciente' :
               filtroTipo === 'dispensacoes-produtos' ? 'Dispensações por Produto' :
               filtroTipo === 'entradas' ? 'Entradas de Produtos' :
               'Histórico de Movimentações'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-6">
            <div className="p-4 md:p-0">
              {renderContent()}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="logs">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Logs do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {logs?.map((log) => (
                <div key={log.id} className="border rounded-lg p-3">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-sm md:text-base">{log.acao}</p>
                      <p className="text-xs md:text-sm text-gray-600">Tabela: {log.tabela}</p>
                      {log.detalhes && (
                        <p className="text-xs text-gray-500 mt-1 break-all">
                          {JSON.stringify(log.detalhes)}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs self-start">
                      {format(new Date(log.created_at || ''), 'dd/MM HH:mm', { locale: ptBR })}
                    </Badge>
                  </div>
                </div>
              ))}
              {(!logs || logs.length === 0) && (
                <p className="text-center text-gray-500 py-8">
                  Nenhum log encontrado
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
