
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, TrendingUp, TrendingDown, Package, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ProductEntry, Dispensation } from '@/types';

export function HistoryView() {
  const [filtroDataInicial, setFiltroDataInicial] = useState('');
  const [filtroDataFinal, setFiltroDataFinal] = useState('');
  const [filtroProduto, setFiltroProduto] = useState('all');
  const [filtroPaciente, setFiltroPaciente] = useState('all');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  // Buscar entradas
  const { data: entradas, isLoading: isLoadingEntradas } = useQuery({
    queryKey: ['historico-entradas', filtroDataInicial, filtroDataFinal, filtroProduto],
    queryFn: async () => {
      let query = supabase
        .from('entradas_produtos')
        .select(`
          *,
          produto:produto_id (
            descricao,
            codigo,
            unidade_medida
          )
        `)
        .order('created_at', { ascending: false });

      if (filtroDataInicial) {
        query = query.gte('data_entrada', filtroDataInicial);
      }
      if (filtroDataFinal) {
        query = query.lte('data_entrada', filtroDataFinal);
      }
      if (filtroProduto && filtroProduto !== 'all') {
        query = query.eq('produto_id', filtroProduto);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductEntry[];
    }
  });

  // Buscar dispensações
  const { data: dispensacoes, isLoading: isLoadingDispensacoes } = useQuery({
    queryKey: ['historico-dispensacoes', filtroDataInicial, filtroDataFinal, filtroProduto, filtroPaciente],
    queryFn: async () => {
      let query = supabase
        .from('dispensacoes')
        .select(`
          *,
          paciente:paciente_id (
            nome,
            sus_cpf
          ),
          produto:produto_id (
            descricao,
            codigo,
            unidade_medida
          )
        `)
        .order('created_at', { ascending: false });

      if (filtroDataInicial) {
        query = query.gte('data_dispensa', filtroDataInicial);
      }
      if (filtroDataFinal) {
        query = query.lte('data_dispensa', filtroDataFinal);
      }
      if (filtroProduto && filtroProduto !== 'all') {
        query = query.eq('produto_id', filtroProduto);
      }
      if (filtroPaciente && filtroPaciente !== 'all') {
        query = query.eq('paciente_id', filtroPaciente);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Dispensation[];
    }
  });

  // Buscar produtos para filtro
  const { data: produtos } = useQuery({
    queryKey: ['produtos-filtro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, descricao, codigo')
        .order('descricao');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar pacientes para filtro
  const { data: pacientes } = useQuery({
    queryKey: ['pacientes-filtro'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nome, sus_cpf')
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar logs do sistema
  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['logs-sistema'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logs_sistema')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  // Estatísticas
  const totalEntradas = entradas?.reduce((sum, entrada) => sum + entrada.quantidade, 0) || 0;
  const totalDispensacoes = dispensacoes?.reduce((sum, dispensacao) => sum + dispensacao.quantidade, 0) || 0;

  // Movimentações combinadas
  const movimentacoes = [
    ...(entradas?.map(entrada => ({
      ...entrada,
      tipo: 'entrada' as const,
      data: entrada.data_entrada,
      descricao_produto: entrada.produto?.descricao || '',
      paciente: null
    })) || []),
    ...(dispensacoes?.map(dispensacao => ({
      ...dispensacao,
      tipo: 'dispensacao' as const,
      data: dispensacao.data_dispensa,
      descricao_produto: dispensacao.produto?.descricao || '',
      paciente: dispensacao.paciente?.nome || ''
    })) || [])
  ].sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

  const movimentacoesFiltradas = movimentacoes.filter(mov => {
    if (filtroTipo === 'entradas') return mov.tipo === 'entrada';
    if (filtroTipo === 'dispensacoes') return mov.tipo === 'dispensacao';
    return true;
  });

  // Função para calcular movimentações de hoje
  const getMovimentacoesHoje = () => {
    const hoje = format(new Date(), 'yyyy-MM-dd');
    return movimentacoes.filter(mov => 
      format(new Date(mov.data), 'yyyy-MM-dd') === hoje
    ).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <History className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Históricos</h1>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Entradas</p>
                <p className="text-2xl font-bold text-green-600">{totalEntradas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Total Dispensações</p>
                <p className="text-2xl font-bold text-red-600">{totalDispensacoes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Produtos Movimentados</p>
                <p className="text-2xl font-bold text-blue-600">{produtos?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Movimentações Hoje</p>
                <p className="text-2xl font-bold text-purple-600">
                  {getMovimentacoesHoje()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="filtroDataInicial">Data Inicial</Label>
              <Input
                id="filtroDataInicial"
                type="date"
                value={filtroDataInicial}
                onChange={(e) => setFiltroDataInicial(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filtroDataFinal">Data Final</Label>
              <Input
                id="filtroDataFinal"
                type="date"
                value={filtroDataFinal}
                onChange={(e) => setFiltroDataFinal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filtroProduto">Produto</Label>
              <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {produtos?.map((produto) => (
                    <SelectItem key={produto.id} value={produto.id}>
                      {produto.descricao} ({produto.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filtroPaciente">Paciente</Label>
              <Select value={filtroPaciente} onValueChange={setFiltroPaciente}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os pacientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os pacientes</SelectItem>
                  {pacientes?.map((paciente) => (
                    <SelectItem key={paciente.id} value={paciente.id}>
                      {paciente.nome} ({paciente.sus_cpf})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <div>
              <Label htmlFor="filtroTipo">Tipo de Movimentação</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="entradas">Apenas Entradas</SelectItem>
                  <SelectItem value="dispensacoes">Apenas Dispensações</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Histórico */}
      <Tabs defaultValue="movimentacoes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          <TabsTrigger value="logs">Logs do Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="movimentacoes">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Paciente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoesFiltradas.map((mov, index) => (
                    <TableRow key={`${mov.tipo}-${mov.id}-${index}`}>
                      <TableCell>
                        {format(new Date(mov.data), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={mov.tipo === 'entrada' ? 'default' : 'secondary'}>
                          {mov.tipo === 'entrada' ? (
                            <><TrendingUp className="h-3 w-3 mr-1" /> Entrada</>
                          ) : (
                            <><TrendingDown className="h-3 w-3 mr-1" /> Dispensação</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{mov.descricao_produto}</TableCell>
                      <TableCell>{mov.quantidade}</TableCell>
                      <TableCell>{mov.lote}</TableCell>
                      <TableCell>{mov.paciente || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {movimentacoesFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                        Nenhuma movimentação encontrada com os filtros aplicados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Logs do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs?.map((log) => (
                  <div key={log.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{log.acao}</p>
                        <p className="text-sm text-gray-600">Tabela: {log.tabela}</p>
                        {log.detalhes && (
                          <p className="text-xs text-gray-500 mt-1">
                            {JSON.stringify(log.detalhes)}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">
                        {format(new Date(log.created_at || ''), 'dd/MM HH:mm', { locale: ptBR })}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!logs || logs.length === 0) && (
                  <p className="text-center text-gray-500 py-4">
                    Nenhum log encontrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
