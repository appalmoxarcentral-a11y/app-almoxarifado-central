
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search, Trash2, X } from 'lucide-react';
import { formatarData } from '@/lib/date-utils';
import type { Dispensation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';

interface RecentDispensationsProps {
  dispensacoes?: Dispensation[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  isLoading: boolean;
  onDelete?: (id: string) => void;
}

export function RecentDispensations({
  dispensacoes,
  searchValue,
  onSearchChange,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading,
  onDelete
}: RecentDispensationsProps) {
  const { user, hasPermission } = useAuth();
  const isMobile = useIsMobile();
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';
  const isAdmin = user?.tipo === 'ADMIN' || isSuperAdmin;
  const startEntry = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(currentPage * pageSize, totalCount);

  const renderDeleteButton = (dispensacao: Dispensation) => {
    if (!(isAdmin || hasPermission('pode_excluir')) || !onDelete) return null;

    return (
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
    );
  };

  return (
    <Card className="lg:col-span-3">
      <CardHeader className="gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-xl font-bold">Dispensações Recentes</CardTitle>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 self-start md:self-auto">
            <div className="relative w-full sm:w-[340px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar por produto, paciente, lote ou data"
                className="pl-9 pr-9"
              />
              {searchValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => onSearchChange('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Por página</span>
              <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
                <SelectTrigger className="w-[90px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Use nomes, lote, paciente, `7 dias`, `15 dias` ou o mes com 3 letras: `jan`, `fev`, `mar`, `abr`, `mai`, `jun`, `jul`, `ago`, `set`, `out`, `nov`, `dez`.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground mt-2 text-sm font-medium">Carregando dispensações...</p>
          </div>
        ) : (
          <>
            {isMobile ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {dispensacoes?.map((dispensacao) => (
                  <div key={dispensacao.id} className="border border-border bg-muted/20 rounded-xl p-4 hover:bg-muted/40 transition-colors">
                    <div className="flex flex-col gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center flex-wrap gap-2">
                          <p className="font-bold text-sm text-foreground">{dispensacao.produto?.descricao}</p>
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold text-[10px]">
                            {formatarData(dispensacao.data_dispensa, 'dd/MM')}
                          </Badge>
                          {isSuperAdmin && (
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-blue-600/30 text-blue-600 bg-blue-600/5">
                              {(dispensacao as any).tenant?.name}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">
                          {dispensacao.paciente?.nome}
                          {dispensacao.is_servidor && (dispensacao.paciente as any)?.sector && (
                            <span className="text-primary ml-1">
                              • {(dispensacao.paciente as any).sector}
                            </span>
                          )}
                        </p>

                        <div className="flex flex-wrap gap-2">
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
                          {dispensacao.is_servidor && (
                            <Badge variant="outline" className="text-[10px] font-bold h-5 border-blue-500 text-blue-500 bg-blue-500/5">
                              Servidor
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        {renderDeleteButton(dispensacao)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto">
                  <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.7fr)_1fr_1fr_auto_auto] gap-3 px-4 py-3 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <div>Produto</div>
                    <div>Paciente/Receptor</div>
                    <div>Lote</div>
                    <div>Quantidade</div>
                    <div>Data</div>
                    <div className="text-right">Ações</div>
                  </div>
                  {dispensacoes?.map((dispensacao) => (
                    <div
                      key={dispensacao.id}
                      className="grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.7fr)_1fr_1fr_auto_auto] gap-3 px-4 py-3 border-b border-border last:border-b-0 items-center hover:bg-muted/20 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{dispensacao.produto?.descricao}</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {isSuperAdmin && (
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-blue-600/30 text-blue-600 bg-blue-600/5">
                              {(dispensacao as any).tenant?.name}
                            </Badge>
                          )}
                          {dispensacao.is_parcial && (
                            <Badge variant="outline" className="text-[10px] font-bold h-5 border-amber-500 text-amber-500 bg-amber-500/5">
                              Parcial
                            </Badge>
                          )}
                          {dispensacao.is_servidor && (
                            <Badge variant="outline" className="text-[10px] font-bold h-5 border-blue-500 text-blue-500 bg-blue-500/5">
                              Servidor
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{dispensacao.paciente?.nome}</div>
                        {dispensacao.is_servidor && (dispensacao.paciente as any)?.sector && (
                          <div className="text-xs text-muted-foreground truncate">{(dispensacao.paciente as any).sector}</div>
                        )}
                      </div>
                      <div className="text-sm font-medium">{dispensacao.lote}</div>
                      <div className="text-sm">
                        {dispensacao.quantidade} {dispensacao.produto?.unidade_medida}
                      </div>
                      <div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold text-[10px]">
                          {formatarData(dispensacao.data_dispensa, 'dd/MM')}
                        </Badge>
                      </div>
                      <div className="flex justify-end">
                        {renderDeleteButton(dispensacao)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!dispensacoes || dispensacoes.length === 0) && (
              <div className="py-12 text-center border-2 border-dashed border-muted rounded-2xl">
                <p className="text-muted-foreground font-medium italic">
                  Nenhuma dispensação registrada ainda.
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2">
          <div className="text-sm text-muted-foreground">
            Mostrando {startEntry}-{endEntry} de {totalCount} dispensações
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <div className="text-sm">
              Página {currentPage} de {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
