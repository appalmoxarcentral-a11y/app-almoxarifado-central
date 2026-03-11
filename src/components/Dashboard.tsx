
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, Package, TrendingUp, TrendingDown, AlertTriangle, Calendar } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Dashboard() {
  const { data: produtoStats } = useQuery({
    queryKey: ['produto-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos').select('estoque_atual');
      if (error) throw error;
      const total = data.length;
      const baixoEstoque = data.filter(p => p.estoque_atual <= 10).length;
      return { total, baixoEstoque };
    }
  });

  const { data: pacienteStats } = useQuery({
    queryKey: ['paciente-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('id');
      if (error) throw error;
      return data.length;
    }
  });

  const { data: entradasMes } = useQuery({
    queryKey: ['entradas-mes'],
    queryFn: async () => {
      const inicioMes = startOfMonth(new Date()).toISOString().split('T')[0];
      const { data, error } = await supabase.from('entradas_produtos').select('quantidade').gte('data_entrada', inicioMes);
      if (error) throw error;
      const total = data.reduce((sum, entrada) => sum + entrada.quantidade, 0);
      return { count: data.length, total };
    }
  });

  const { data: dispensacoesMes } = useQuery({
    queryKey: ['dispensacoes-mes'],
    queryFn: async () => {
      const inicioMes = startOfMonth(new Date()).toISOString().split('T')[0];
      const { data, error } = await supabase.from('dispensacoes').select('quantidade').gte('data_dispensa', inicioMes);
      if (error) throw error;
      const total = data.reduce((sum, dispensacao) => sum + dispensacao.quantidade, 0);
      return { count: data.length, total };
    }
  });

  const { data: produtosVencendo } = useQuery({
    queryKey: ['produtos-vencendo'],
    queryFn: async () => {
      const proximosMes = new Date();
      proximosMes.setMonth(proximosMes.getMonth() + 1);
      const { data, error } = await supabase
        .from('entradas_produtos')
        .select(`vencimento, lote, quantidade, produtos:produto_id (descricao, codigo)`)
        .lte('vencimento', proximosMes.toISOString().split('T')[0])
        .order('vencimento')
        .limit(5);
      if (error) throw error;
      return data;
    }
  });

  const { data: produtosBaixoEstoque } = useQuery({
    queryKey: ['produtos-baixo-estoque'],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos').select('*').lte('estoque_atual', 10).order('estoque_atual').limit(5);
      if (error) throw error;
      return data;
    }
  });

  const { data: movimentacoesRecentes } = useQuery({
    queryKey: ['movimentacoes-recentes'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const [entradas, dispensacoes] = await Promise.all([
        supabase.from('entradas_produtos').select(`*, produtos:produto_id (descricao)`).eq('data_entrada', hoje).order('created_at', { ascending: false }).limit(3),
        supabase.from('dispensacoes').select(`*, produtos:produto_id (descricao), pacientes:paciente_id (nome)`).eq('data_dispensa', hoje).order('created_at', { ascending: false }).limit(3)
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Pacientes</p>
                <p className="text-xl md:text-3xl font-bold text-primary">{pacienteStats || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 md:h-8 md:w-8 text-secondary" />
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Produtos</p>
                <p className="text-xl md:text-3xl font-bold text-secondary">{produtoStats?.total || 0}</p>
                {produtoStats?.baixoEstoque ? (
                  <p className="text-[10px] md:text-xs text-destructive">{produtoStats.baixoEstoque} estoque baixo</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-secondary" />
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Entradas/Mês</p>
                <p className="text-xl md:text-3xl font-bold text-secondary">{entradasMes?.count || 0}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">{entradasMes?.total || 0} un.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-6 w-6 md:h-8 md:w-8 text-destructive" />
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Dispensações/Mês</p>
                <p className="text-xl md:text-3xl font-bold text-destructive">{dispensacoesMes?.count || 0}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground">{dispensacoesMes?.total || 0} un.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Alertas */}
        <div className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-destructive" />
                Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 md:space-y-3">
                {produtosBaixoEstoque?.map((produto) => (
                  <div key={produto.id} className="flex justify-between items-center p-2.5 md:p-3 bg-destructive/10 rounded-lg">
                    <div>
                      <p className="font-medium text-sm text-foreground">{produto.descricao}</p>
                      <p className="text-xs text-muted-foreground">Código: {produto.codigo}</p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {produto.estoque_atual} {produto.unidade_medida}
                    </Badge>
                  </div>
                ))}
                {(!produtosBaixoEstoque || produtosBaixoEstoque.length === 0) && (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    Nenhum produto com estoque baixo
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
                Próximos ao Vencimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 md:space-y-3">
                {produtosVencendo?.map((entrada, index) => (
                  <div key={index} className="flex justify-between items-center p-2.5 md:p-3 bg-accent rounded-lg">
                    <div>
                      <p className="font-medium text-sm text-foreground">{entrada.produtos?.descricao}</p>
                      <p className="text-xs text-muted-foreground">Lote: {entrada.lote}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {format(new Date(entrada.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">{entrada.quantidade} un.</p>
                    </div>
                  </div>
                ))}
                {(!produtosVencendo || produtosVencendo.length === 0) && (
                  <p className="text-center text-muted-foreground py-4 text-sm">
                    Nenhum produto próximo ao vencimento
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Movimentações Recentes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Activity className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              Movimentações de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 md:space-y-3">
              {movimentacoesRecentes?.map((mov, index) => (
                <div key={index} className="flex justify-between items-center p-2.5 md:p-3 border border-border rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-foreground">{mov.produtos?.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {mov.tipo === 'entrada' ? 'Entrada' : `Dispensação - ${mov.pacientes?.nome}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Lote: {mov.lote}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={mov.tipo === 'entrada' ? 'default' : 'secondary'}>
                      {mov.tipo === 'entrada' ? (
                        <><TrendingUp className="h-3 w-3 mr-1" /> +{mov.quantidade}</>
                      ) : (
                        <><TrendingDown className="h-3 w-3 mr-1" /> -{mov.quantidade}</>
                      )}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(mov.created_at || ''), 'HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
              {(!movimentacoesRecentes || movimentacoesRecentes.length === 0) && (
                <p className="text-center text-muted-foreground py-4 text-sm">
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
