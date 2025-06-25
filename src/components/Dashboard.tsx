
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Package, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { DashboardStats } from "@/types";

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    total_produtos: 0,
    produtos_vencendo: 0,
    produtos_estoque_baixo: 0,
    dispensacoes_mes: 0,
    entradas_mes: 0,
  });

  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [produtosVencendo, setProdutosVencendo] = useState<any[]>([]);

  const loadDashboardData = async () => {
    try {
      // Carregar estatísticas gerais
      const { data: produtos } = await supabase
        .from('produtos')
        .select('*');

      const { data: dispensacoes } = await supabase
        .from('dispensacoes')
        .select('*')
        .gte('data_dispensa', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);

      const { data: entradas } = await supabase
        .from('entradas_produtos')
        .select('*')
        .gte('data_entrada', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);

      // Calcular estatísticas
      const totalProdutos = produtos?.length || 0;
      const produtosEstoqueBaixo = produtos?.filter(p => p.estoque_atual < 10).length || 0;
      const dispensacoesMes = dispensacoes?.length || 0;
      const entradasMes = entradas?.length || 0;

      setStats({
        total_produtos: totalProdutos,
        produtos_vencendo: 0, // Será implementado quando houver dados de vencimento
        produtos_estoque_baixo: produtosEstoqueBaixo,
        dispensacoes_mes: dispensacoesMes,
        entradas_mes: entradasMes,
      });

      // Carregar atividades recentes
      const { data: recentDisp } = await supabase
        .from('dispensacoes')
        .select(`
          *,
          paciente:pacientes(nome),
          produto:produtos(descricao)
        `)
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: recentEnt } = await supabase
        .from('entradas_produtos')
        .select(`
          *,
          produto:produtos(descricao)
        `)
        .order('created_at', { ascending: false })
        .limit(2);

      const activities = [
        ...(recentDisp?.map(d => ({
          id: d.id,
          type: 'dispensacao',
          produto: d.produto?.descricao || 'Produto não encontrado',
          paciente: d.paciente?.nome || 'Paciente não encontrado',
          quantidade: d.quantidade,
          tempo: new Date(d.created_at).toLocaleString('pt-BR')
        })) || []),
        ...(recentEnt?.map(e => ({
          id: e.id,
          type: 'entrada',
          produto: e.produto?.descricao || 'Produto não encontrado',
          quantidade: e.quantidade,
          tempo: new Date(e.created_at).toLocaleString('pt-BR')
        })) || [])
      ].sort((a, b) => new Date(b.tempo).getTime() - new Date(a.tempo).getTime()).slice(0, 3);

      setRecentActivity(activities);

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Visão geral do sistema farmacêutico</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          {new Date().toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="medical-gradient text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_produtos}</div>
            <p className="text-xs opacity-80">cadastrados</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Próximos ao Vencimento</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-800">{stats.produtos_vencendo}</div>
            <p className="text-xs text-orange-600">próximos 30 dias</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Estoque Baixo</CardTitle>
            <Activity className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{stats.produtos_estoque_baixo}</div>
            <p className="text-xs text-red-600">produtos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispensações/Mês</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.dispensacoes_mes}</div>
            <p className="text-xs text-muted-foreground">este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas/Mês</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.entradas_mes}</div>
            <p className="text-xs text-muted-foreground">lotes recebidos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atividade Recente */}
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
            <CardDescription>Últimas movimentações do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Nenhuma atividade recente.</p>
              ) : (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {activity.type === 'dispensacao' ? (
                        <div className="p-2 bg-blue-100 rounded-full">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                      ) : (
                        <div className="p-2 bg-green-100 rounded-full">
                          <Package className="h-4 w-4 text-green-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{activity.produto}</p>
                        <p className="text-sm text-gray-500">
                          {activity.type === 'dispensacao' 
                            ? `${activity.paciente} - ${activity.quantidade} unidades`
                            : `Entrada: ${activity.quantidade} unidades`
                          }
                        </p>
                      </div>
                    </div>
                    <Badge variant={activity.type === 'dispensacao' ? 'default' : 'secondary'}>
                      {activity.tempo}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Produtos com Estoque Baixo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Produtos com Estoque Baixo
            </CardTitle>
            <CardDescription>Produtos com menos de 10 unidades em estoque</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.produtos_estoque_baixo === 0 ? (
                <p className="text-gray-500 text-center py-4">Todos os produtos com estoque adequado.</p>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  {stats.produtos_estoque_baixo} produto(s) com estoque baixo.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
