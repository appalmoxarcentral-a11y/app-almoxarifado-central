import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function AdminDashboard() {
  const { data: tenants, isLoading, error } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: async () => {
      console.log('Fetching tenants...');
      const { data, error } = await supabase.rpc('get_all_tenants_admin');
      if (error) {
        console.error('Supabase RPC Error:', error);
        throw error;
      }
      
      // Filter unique tenants by ID just in case the RPC still returns duplicates
      const uniqueTenants = data?.reduce((acc: any[], current: any) => {
        const x = acc.find(item => item.id === current.id);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
      }, []);
      
      return uniqueTenants;
    },
    retry: false
  });

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'active':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">APROVADO</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500 hover:bg-amber-600">PENDENTE</Badge>;
      case 'waiting':
        return <Badge className="bg-blue-500 hover:bg-blue-600">AGUARDANDO</Badge>;
      case 'trialing':
        return <Badge variant="secondary">Em Trial</Badge>;
      default:
        return <Badge variant="outline">{status || 'Inativo'}</Badge>;
    }
  };

  if (isLoading) return <div className="flex justify-center items-center h-screen">Carregando dashboard...</div>;
  
  if (error) {
    return (
        <div className="flex justify-center items-center h-screen flex-col gap-4">
            <h1 className="text-2xl font-bold text-red-600">Acesso Negado</h1>
            <p className="text-gray-600">{(error as any).message || "Você não tem permissão para acessar o painel administrativo."}</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo SaaS</h1>
            <Badge variant="outline" className="bg-white">Super Admin</Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{tenants?.length || 0}</div>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Assinaturas Ativas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">
                {tenants?.filter((t: any) => t.status?.toLowerCase() === 'active' || t.status?.toLowerCase() === 'paid' || t.status?.toLowerCase() === 'waiting').length || 0}
              </div>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Em Trial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-600">
                {tenants?.filter((t: any) => t.status === 'trialing').length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Clientes e Assinaturas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vencimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants?.map((tenant: any) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{tenant.document || '-'}</TableCell>
                    <TableCell>{tenant.plan_name || 'Sem plano'}</TableCell>
                    <TableCell>
                      {tenant.plan_price 
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(tenant.plan_price))
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(tenant.status)}
                    </TableCell>
                    <TableCell>
                      {tenant.period_end 
                        ? new Date(tenant.period_end).toLocaleDateString() 
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
