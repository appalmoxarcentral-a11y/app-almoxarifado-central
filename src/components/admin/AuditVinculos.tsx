import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { History, ArrowRight, User, Building2, Calendar, ShieldCheck, MessageSquare } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export function AuditVinculos() {
  const isMobile = useIsMobile();
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
      <CardContent className="px-0 sm:px-6">
        {isMobile ? (
          <div className="grid grid-cols-1 gap-4 px-4">
            {logs?.map((log: any) => (
              <div key={log.id} className="bg-muted/30 border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <Badge variant="outline" className="bg-card text-[10px] font-bold py-0.5">
                    {log.admin?.full_name || 'Sistema'}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">Usuário</p>
                      <p className="font-bold text-sm leading-tight">{log.usuario?.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{log.usuario?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">Mudança de Unidade</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground line-through decoration-destructive/30">{log.unidade_anterior?.nome || 'Nenhum'}</span>
                        <ArrowRight className="h-3 w-3 text-primary animate-pulse" />
                        <span className="font-black text-emerald-700">{log.unidade_nova?.nome}</span>
                      </div>
                    </div>
                  </div>

                  {log.motivo && (
                    <div className="flex items-start gap-3 pt-2 border-t border-border/50">
                      <MessageSquare className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">Motivo</p>
                        <p className="text-xs text-zinc-600 italic">"{log.motivo}"</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {logs?.length === 0 && (
              <div className="text-center py-12 bg-muted/30 rounded-2xl border-2 border-dashed border-border">
                <History className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground font-medium">Nenhum registro de auditoria.</p>
              </div>
            )}
          </div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
