import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { History, ArrowRight, User, Building2, Calendar } from 'lucide-react';

export function AuditVinculos() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit_vinculos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_vinculos_unidade')
        .select(`
          *,
          usuario:profiles!usuario_id(full_name, email),
          admin:profiles!admin_id(full_name),
          unidade_anterior:unidades_saude!unidade_anterior_id(nome),
          unidade_nova:unidades_saude!unidade_nova_id(nome)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return <div className="py-8 text-center">Carregando logs de auditoria...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-emerald-600" />
          <div>
            <CardTitle>Auditoria de Vínculos</CardTitle>
            <CardDescription>Histórico de alterações de unidade de saúde dos usuários.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Alteração de Unidade</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs?.map((log: any) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Calendar className="h-3 w-3" />
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-zinc-400" />
                    <div>
                      <div className="font-medium text-sm">{log.usuario?.full_name || 'N/A'}</div>
                      <div className="text-xs text-zinc-500">{log.usuario?.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-500">{log.unidade_anterior?.nome || 'Nenhum'}</span>
                    <ArrowRight className="h-3 w-3 text-zinc-400" />
                    <span className="font-medium text-emerald-700">{log.unidade_nova?.nome}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    {log.admin?.full_name || 'Sistema / Auto'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-zinc-600 max-w-[200px] truncate">
                  {log.motivo}
                </TableCell>
              </TableRow>
            ))}
            {logs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                  Nenhum registro de alteração encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
