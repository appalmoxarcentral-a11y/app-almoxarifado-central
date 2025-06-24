
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, Package, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Dashboard() {
  // Mock data - em produção virá do Supabase
  const stats = {
    total_produtos: 245,
    produtos_vencendo: 12,
    produtos_estoque_baixo: 8,
    dispensacoes_mes: 156,
    entradas_mes: 42,
  };

  const recentActivity = [
    { id: 1, type: 'dispensacao', produto: 'Dipirona 500mg', paciente: 'Maria Silva', quantidade: 20, tempo: '2 min atrás' },
    { id: 2, type: 'entrada', produto: 'Paracetamol 750mg', quantidade: 100, tempo: '15 min atrás' },
    { id: 3, type: 'dispensacao', produto: 'Amoxicilina 500mg', paciente: 'João Santos', quantidade: 21, tempo: '32 min atrás' },
  ];

  const produtosVencendo = [
    { produto: 'Insulina NPH', lote: 'L001', vencimento: '2024-07-15', dias: 5 },
    { produto: 'Captopril 25mg', lote: 'L002', vencimento: '2024-07-20', dias: 10 },
    { produto: 'Losartana 50mg', lote: 'L003', vencimento: '2024-07-25', dias: 15 },
  ];

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
            <p className="text-xs opacity-80">em estoque</p>
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
            <p className="text-xs text-muted-foreground">+12% vs mês anterior</p>
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
              {recentActivity.map((activity) => (
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
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Produtos Próximos ao Vencimento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Produtos Vencendo
            </CardTitle>
            <CardDescription>Produtos com vencimento próximo (30 dias)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {produtosVencendo.map((produto, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-orange-50 border-orange-200">
                  <div>
                    <p className="font-medium text-orange-800">{produto.produto}</p>
                    <p className="text-sm text-orange-600">
                      Lote: {produto.lote} | Vence: {new Date(produto.vencimento).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant={produto.dias <= 7 ? 'destructive' : 'secondary'}>
                    {produto.dias} dias
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
