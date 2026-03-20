
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Dispensation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface RecentDispensationsProps {
  dispensacoes?: Dispensation[];
  isLoading: boolean;
  onDelete?: (id: string) => void;
}

export function RecentDispensations({ dispensacoes, isLoading, onDelete }: RecentDispensationsProps) {
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';
  const isAdmin = user?.tipo === 'ADMIN' || isSuperAdmin;

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Dispensações Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2 text-sm font-medium">Carregando dispensações...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
            {dispensacoes?.map((dispensacao) => (
              <div key={dispensacao.id} className="border border-border bg-muted/20 rounded-xl p-4 hover:bg-muted/40 transition-colors">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <p className="font-bold text-sm text-foreground">{dispensacao.produto?.descricao}</p>
                      {isSuperAdmin && (
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-blue-600/30 text-blue-600 bg-blue-600/5">
                          {(dispensacao as any).tenant?.name}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                      {dispensacao.paciente?.nome}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="secondary" className="text-[10px] font-bold h-5">
                        Lote: {dispensacao.lote}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-bold h-5">
                        Qtd: {dispensacao.quantidade} {dispensacao.produto?.unidade_medida}
                      </Badge>
                      {dispensacao.is_parcial && (
                        <Badge variant="outline" className="text-[10px] font-bold h-5 border-amber-500 text-amber-500 bg-amber-500/5">
                          Parcial
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold text-[10px]">
                      {format(new Date(dispensacao.data_dispensa), 'dd/MM', { locale: ptBR })}
                    </Badge>

                    {(isAdmin || hasPermission('pode_excluir')) && onDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Dispensação</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir este registro de dispensação?
                              <br /><br />
                              <strong>Paciente:</strong> {dispensacao.paciente?.nome}
                              <br />
                              <strong>Produto:</strong> {dispensacao.produto?.descricao}
                              <br /><br />
                              O estoque será devolvido automaticamente. Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(dispensacao.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(!dispensacoes || dispensacoes.length === 0) && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-muted rounded-2xl">
                <p className="text-muted-foreground font-medium italic">
                  Nenhuma dispensação registrada ainda.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
