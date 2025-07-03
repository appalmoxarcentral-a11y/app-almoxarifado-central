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
import { Button } from '@/components/ui/button';
import { History, TrendingUp, TrendingDown, Package, Users, Calendar, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { ProductEntry, Dispensation } from '@/types';
import { StockOnlyTable } from './history/StockOnlyTable';

export function HistoryView() {
  const [filtroDataInicial, setFiltroDataInicial] = useState('');
  const [filtroDataFinal, setFiltroDataFinal] = useState('');
  const [filtroProduto, setFiltroProduto] = useState('all');
  const [filtroPaciente, setFiltroPaciente] = useState('all');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroNomePaciente, setFiltroNomePaciente] = useState('');

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
    queryKey: ['historico-dispensacoes', filtroDataInicial, filtroDataFinal, filtroProduto, filtroPaciente, filtroNomePaciente],
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
      
      // Filtrar por nome do paciente se especificado
      let filteredData = data as Dispensation[];
      if (filtroNomePaciente) {
        filteredData = filteredData.filter(dispensacao => 
          dispensacao.paciente?.nome.toLowerCase().includes(filtroNomePaciente.toLowerCase())
        );
      }
      
      return filteredData;
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

  // Função para limpar filtros
  const limparFiltros = () => {
    setFiltroDataInicial('');
    setFiltroDataFinal('');
    setFiltroProduto('all');
    setFiltroPaciente('all');
    setFiltroNomePaciente('');
    setFiltroTipo('todos');
  };

  // Verificar se há filtros ativos
  const hasActiveFilters = filtroDataInicial || filtroDataFinal || filtroProduto !== 'all' || 
                          filtroPaciente !== 'all' || filtroNomePaciente || filtroTipo !== 'todos';

  // Componente de filtros para mobile
  const MobileFilters = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="filtroDataInicial">Data Inicial</Label>
          <Input
            id="filtroDataInicial"
            type="date"
            value={filtroDataInicial}
            onChange={(e) => setFiltroDataInicial(e.target.value)}
            className="h-12"
          />
        </div>
        <div>
          <Label htmlFor="filtroDataFinal">Data Final</Label>
          <Input
            id="filtroDataFinal"
            type="date"
            value={filtroDataFinal}
            onChange={(e) => setFiltroDataFinal(e.target.value)}
            className="h-12"
          />
        </div>
        <div>
          <Label htmlFor="filtroProduto">Produto</Label>
          <Select value={filtroProduto} onValueChange={setFiltroProduto}>
            <SelectTrigger className="h-12">
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
          <Label htmlFor="filtroPaciente">Paciente (Lista)</Label>
          <Select value={filtroPaciente} onValueChange={setFiltroPaciente}>
            <SelectTrigger className="h-12">
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
        <div>
          <Label htmlFor="filtroNomePaciente">Buscar por Nome</Label>
          <Input
            id="filtroNomePaciente"
            value={filtroNomePaciente}
            onChange={(e) => setFiltroNomePaciente(e.target.value)}
            placeholder="Digite o nome do paciente"
            className="h-12"
          />
        </div>
        <div>
          <Label htmlFor="filtroTipo">Tipo de Movimentação</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="entradas">Apenas Entradas</SelectItem>
              <SelectItem value="dispensacoes">Apenas Dispensações</SelectItem>
              <SelectItem value="apenas-estoque">Apenas em estoque</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {hasActiveFilters && (
        <Button onClick={limparFiltros} variant="outline" className="w-full h-12">
          <X className="h-4 w-4 mr-2" />
          Limpar Filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <History className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Históricos</h1>
          <p className="text-sm md:text-base text-gray-600">Controle de movimentações</p>
        </div>
      </div>

      {/* Cards de Estatísticas - Otimizado para mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
              <div>
                <p className="text-xs md:text-sm text-gray-600">Entradas</p>
                <p className="text-lg md:text-2xl font-bold text-green-600">{totalEntradas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
              <div>
                <p className="text-xs md:text-sm text-gray-600">Dispensações</p>
                <p className="text-lg md:text-2xl font-bold text-red-600">{totalDispensacoes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <Package className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              <div>
                <p className="text-xs md:text-sm text-gray-600">Produtos</p>
                <p className="text-lg md:text-2xl font-bold text-blue-600">{produtos?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <Calendar className="h-4 w-4 md:h-5 md:w-5 text-purple-600" />
              <div>
                <p className="text-xs md:text-sm text-gray-600">Hoje</p>
                <p className="text-lg md:text-2xl font-bold text-purple-600">
                  {getMovimentacoesHoje()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros - Desktop e Mobile */}
      <div className="block md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full h-12 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-auto">
                  Ativos
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[90vh]">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>
                Configure os filtros para personalizar a visualização
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <MobileFilters />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Filtros
              {hasActiveFilters && (
                <Button onClick={limparFiltros} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                <Label htmlFor="filtroPaciente">Paciente (Lista)</Label>
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
              <div>
                <Label htmlFor="filtroNomePaciente">Buscar por Nome</Label>
                <Input
                  id="filtroNomePaciente"
                  value={filtroNomePaciente}
                  onChange={(e) => setFiltroNomePaciente(e.target.value)}
                  placeholder="Digite o nome do paciente"
                />
              </div>
              <div>
                <Label htmlFor="filtroTipo">Tipo de Movimentação</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="entradas">Apenas Entradas</SelectItem>
                    <SelectItem value="dispensacoes">Apenas Dispensações</SelectItem>
                    <SelectItem value="apenas-estoque">Apenas em estoque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Histórico - Otimizado para mobile */}
      <Tabs defaultValue="movimentacoes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="movimentacoes" className="text-sm">Movimentações</TabsTrigger>
          <TabsTrigger value="logs" className="text-sm">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="movimentacoes">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">
                {filtroTipo === 'apenas-estoque' ? 'Produtos em Estoque' : 'Histórico de Movimentações'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              {filtroTipo === 'apenas-estoque' ? (
                <div className="p-4 md:p-0">
                  <StockOnlyTable />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">Data</TableHead>
                        <TableHead className="min-w-[120px]">Tipo</TableHead>
                        <TableHead className="min-w-[150px]">Produto</TableHead>
                        <TableHead className="min-w-[80px]">Qtd</TableHead>
                        <TableHead className="min-w-[100px]">Lote</TableHead>
                        <TableHead className="min-w-[120px]">Paciente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimentacoesFiltradas.map((mov, index) => (
                        <TableRow key={`${mov.tipo}-${mov.id}-${index}`}>
                          <TableCell className="text-xs md:text-sm">
                            {format(new Date(mov.data), 'dd/MM/yy', { locale: ptBR })}
                          </TableCell>
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
                      {movimentacoesFiltradas.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            Nenhuma movimentação encontrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
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
    </div>
  );
}
