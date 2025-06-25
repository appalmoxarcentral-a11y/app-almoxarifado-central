
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, Package, TrendingUp, TrendingDown, AlertTriangle, Calendar } from 'lucide-react';
import { format, subDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Dashboard() {
  // Buscar estatísticas de produtos
  const { data: produtoStats } = useQuery({
    queryKey: ['produto-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('estoque_atual');
      
      if (error) throw error;
      
      const total = data.length;
      const baixoEstoque = data.filter(p => p.estoque_atual <= 10).length;
      
      return { total, baixoEstoque };
    }
  });

  // Buscar estatísticas de pacientes
  const { data: pacienteStats } = useQuery({
    queryKey: ['paciente-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id');
      
      if (error) throw error;
      return data.length;
    }
  });

  // Buscar entradas do mês
  const { data: entradasMes } = useQuery({
    queryKey: ['entradas-mes'],
    queryFn: async () => {
      const inicioMes = startOfMonth(new Date()).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('entradas_produtos')
        .select('quantidade')
        .gte('data_entrada', inicioMes);
      
      if (error) throw error;
      
      const total = data.reduce((sum, entrada) => sum + entrada.quantidade, 0);
      return { count: data.length, total };
    }
  });

  // Buscar dispensações do mês
  const { data: dispensacoesMes } = useQuery({
    queryKey: ['dispensacoes-mes'],
    queryFn: async () => {
      const inicioMes = startOfMonth(new Date()).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('dispensacoes')
        .select('quantidade')
        .gte('data_dispensa', inicioMes);
      
      if (error) throw error;
      
      const total = data.reduce((sum, dispensacao) => sum + dispensacao.quantidade, 0);
      return { count: data.length, total };
    }
  });

  // Buscar produtos próximos ao vencimento
  const { data: produtosVencendo } = useQuery({
    queryKey: ['produtos-vencendo'],
    queryFn: async () => {
      const proximosMes = new Date();
      proximosMes.setMonth(proximosMes.getMonth() + 1);
      
      const { data, error } = await supabase
        .from('entradas_produtos')
        .select(`
          vencimento,
          lote,
          quantidade,
          produtos:produto_id (
            descricao,
            codigo
          )
        `)
        .lte('vencimento', proximosMes.toISOString().split('T')[0])
        .order('vencimento')
        .limit(5);
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar produtos com estoque baixo
  const { data: produtosBaixoEstoque } = useQuery({
    queryKey: ['produtos-baixo-estoque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .lte('estoque_atual', 10)
        .order('estoque_atual')
        .limit(5);
      
      if (error) throw error;
      return data;
    }
  });

  // Buscar movimentações recentes
  const { data: movimentacoesRecentes } = useQuery({
    queryKey: ['movimentacoes-recentes'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      
      const [entradas, dispensacoes] = await Promise.all([
        supabase
          .from('entradas_produtos')
          .select(`
            *,
            produtos:produto_id (descricao)
          `)
          .eq('data_entrada', hoje)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('dispensacoes')
          .select(`
            *,
            produtos:produto_id (descricao),
            pacientes:paciente_id (nome)
          `)
          .eq('data_dispensa', hoje)
          .order('created_at', { ascending: false })
          .limit(3)
      ]);

      if (entradas.error) throw entradas.error;
      if (dispensacoes.error) throw dispensacoes.error;

      return [
        ...entradas.data.map(e => ({ ...e, tipo: 'entrada' as const })),
        ...dispensacoes.data.map(d => ({ ...d, tipo: 'dispensacao' as const }))
      ].sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>

      {/* Cards de Estatísticas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total de Pacientes</p>
                <p className="text-3xl font-bold text-blue-600">{pacienteStats || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Package className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total de Produtos</p>
                <p className="text-3xl font-bold text-green-600">{produtoStats?.total || 0}</p>
                {produtoStats?.baixoEstoque ? (
                  <p className="text-xs text-red-600">{produtoStats.baixoEstoque} com estoque baixo</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Entradas este Mês</p>
                <p className="text-3xl font-bold text-green-600">{entradasMes?.count || 0}</p>
                <p className="text-xs text-gray-500">{entradasMes?.total || 0} unidades</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Dispensações este Mês</p>
                <p className="text-3xl font-bold text-red-600">{dispensacoesMes?.count || 0}</p>
                <p className="text-xs text-gray-500">{dispensacoesMes?.total || 0} unidades</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas e Notificações */}
        <div className="space-y-6">
          {/* Produtos com Estoque Baixo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Produtos com Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {produtosBaixoEstoque?.map((produto) => (
                  <div key={produto.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium">{produto.descricao}</p>
                      <p className="text-sm text-gray-600">Código: {produto.codigo}</p>
                    </div>
                    <Badge variant="destructive">
                      {produto.estoque_atual} {produto.unidade_medida}
                    </Badge>
                  </div>
                ))}
                {(!produtosBaixoEstoque || produtosBaixoEstoque.length === 0) && (
                  <p className="text-center text-gray-500 py-4">
                    Nenhum produto com estoque baixo
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Produtos Próximos ao Vencimento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                Produtos Próximos ao Vencimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {produtosVencendo?.map((entrada, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <div>
                      <p className="font-medium">{entrada.produtos?.descricao}</p>
                      <p className="text-sm text-gray-600">Lote: {entrada.lote}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">
                        {format(new Date(entrada.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">{entrada.quantidade} un.</p>
                    </div>
                  </div>
                ))}
                {(!produtosVencendo || produtosVencendo.length === 0) && (
                  <p className="text-center text-gray-500 py-4">
                    Nenhum produto próximo ao vencimento
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Movimentações Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Movimentações de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {movimentacoesRecentes?.map((mov, index) => (
                <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{mov.produtos?.descricao}</p>
                    <p className="text-sm text-gray-600">
                      {mov.tipo === 'entrada' ? 'Entrada' : `Dispensação - ${mov.pacientes?.nome}`}
                    </p>
                    <p className="text-xs text-gray-500">Lote: {mov.lote}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={mov.tipo === 'entrada' ? 'default' : 'secondary'}>
                      {mov.tipo === 'entrada' ? (
                        <><TrendingUp className="h-3 w-3 mr-1" /> +{mov.quantidade}</>
                      ) : (
                        <><TrendingDown className="h-3 w-3 mr-1" /> -{mov.quantidade}</>
                      )}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(mov.created_at || ''), 'HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              {(!movimentacoesRecentes || movimentacoesRecentes.length === 0) && (
                <p className="text-center text-gray-500 py-4">
                  Nenhuma movimentação hoje
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
