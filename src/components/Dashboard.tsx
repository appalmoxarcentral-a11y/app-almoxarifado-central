
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Users, Package, TrendingUp, TrendingDown, AlertTriangle, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns/format';
import { startOfMonth } from 'date-fns/startOfMonth';
import { ptBR } from 'date-fns/locale/pt-BR';
import { useAuth } from '@/contexts/AuthContext';

export function Dashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';
  const isSubscriptionBlocked = user?.subscription_blocked && !isSuperAdmin;
  const unidadeId = user?.unidade_id;

  const { data: produtoStats } = useQuery({
    queryKey: ['produto-stats', unidadeId],
    queryFn: async () => {
      let totalQuery = supabase.from('produtos').select('*', { count: 'exact', head: true });
      let baixoQuery = supabase.from('produtos').select('*', { count: 'exact', head: true }).lte('estoque_atual', 10);

      if (unidadeId) {
        // Para o alerta de estoque baixo, filtramos pela unidade
        baixoQuery = baixoQuery.eq('unidade_id', unidadeId);
      }

      const [totalRes, baixoRes] = await Promise.all([totalQuery, baixoQuery]);
      
      if (totalRes.error) throw totalRes.error;
      if (baixoRes.error) throw baixoRes.error;
      
      return { 
        total: totalRes.count || 0, 
        baixoEstoque: baixoRes.count || 0 
      };
    }
  });

  const { data: pacienteStats } = useQuery({
    queryKey: ['paciente-stats'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('pacientes')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: entradasMes } = useQuery({
    queryKey: ['entradas-mes', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return { count: 0, total: 0 };
      const inicioMes = startOfMonth(new Date()).toISOString().split('T')[0];
      let query = supabase.from('entradas_produtos').select('quantidade').gte('data_entrada', inicioMes);
      
      query = query.eq('unidade_id', unidadeId);

      const { data, error } = await query;
      if (error) throw error;
      const total = data.reduce((sum, entrada) => sum + entrada.quantidade, 0);
      return { count: data.length, total };
    }
  });

  const { data: dispensacoesMes } = useQuery({
    queryKey: ['dispensacoes-mes', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return { count: 0, total: 0 };
      const inicioMes = startOfMonth(new Date()).toISOString().split('T')[0];
      let query = supabase.from('dispensacoes').select('quantidade').gte('data_dispensa', inicioMes);
      
      query = query.eq('unidade_id', unidadeId);

      const { data, error } = await query;
      if (error) throw error;
      const total = data.reduce((sum, dispensacao) => sum + dispensacao.quantidade, 0);
      return { count: data.length, total };
    }
  });

  const { data: produtosVencendo } = useQuery({
    queryKey: ['produtos-vencendo', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];
      const proximosMes = new Date();
      proximosMes.setMonth(proximosMes.getMonth() + 1);
      let query = supabase
        .from('entradas_produtos')
        .select(`vencimento, lote, quantidade, produtos:produto_id (descricao, codigo)`)
        .lte('vencimento', proximosMes.toISOString().split('T')[0]);
      
      query = query.eq('unidade_id', unidadeId);

      const { data, error } = await query.order('vencimento').limit(5);
      if (error) throw error;
      return data;
    }
  });

  const { data: produtosBaixoEstoque } = useQuery({
    queryKey: ['produtos-baixo-estoque', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];
      let query = supabase.from('produtos').select('*').lte('estoque_atual', 10);
      
      query = query.eq('unidade_id', unidadeId);

      const { data, error } = await query.order('estoque_atual').limit(5);
      if (error) throw error;
      return data;
    }
  });

  const { data: movimentacoesRecentes } = useQuery({
    queryKey: ['movimentacoes-recentes', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];
      const hoje = new Date().toISOString().split('T')[0];
      
      let entradasQuery = supabase.from('entradas_produtos').select(`*, produtos:produto_id (descricao)`).eq('data_entrada', hoje);
      let dispensacoesQuery = supabase.from('dispensacoes').select(`*, produtos:produto_id (descricao), pacientes:paciente_id (nome)`).eq('data_dispensa', hoje);

      entradasQuery = entradasQuery.eq('unidade_id', unidadeId);
      dispensacoesQuery = dispensacoesQuery.eq('unidade_id', unidadeId);

      const [entradas, dispensacoes] = await Promise.all([
        entradasQuery.order('created_at', { ascending: false }).limit(3),
        dispensacoesQuery.order('created_at', { ascending: false }).limit(3)
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

      {isSubscriptionBlocked && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              Acesso Restrito: Sua unidade possui faturas pendentes.
            </p>
            <p className="text-xs text-red-700">
              {user?.tipo === 'ADMIN' 
                ? "As funcionalidades do sistema estão bloqueadas. Regularize sua assinatura para liberar o acesso total."
                : "Entre em contato com o administrador da sua unidade para regularizar a assinatura."}
            </p>
          </div>
          {user?.tipo === 'ADMIN' && (
            <Badge 
              className="bg-red-600 hover:bg-red-700 cursor-pointer"
              onClick={() => window.location.href = '/assinatura'}
            >
              Ir para Pagamento
            </Badge>
          )}
        </div>
      )}

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
