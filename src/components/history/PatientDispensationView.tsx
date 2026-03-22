
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Package, Calendar, AlertTriangle, TrendingDown, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatarData } from '@/lib/date-utils';
import type { Dispensation, Patient } from '@/types';

interface PatientDispensationViewProps {
  searchTerm: string;
}

interface PatientWithDispensations {
  id: string;
  nome: string;
  sus_cpf: string;
  endereco: string;
  bairro: string;
  telefone: string;
  nascimento: string;
  idade: number;
  is_health_worker?: boolean;
  sector?: string;
  dispensacoes: Dispensation[];
  total_produtos_diferentes: number;
  total_quantidade_dispensada: number;
}

export function PatientDispensationView({ searchTerm }: PatientDispensationViewProps) {
  const { data: pacientesComDispensacoes, isLoading } = useQuery({
    queryKey: ['pacientes-com-dispensacoes', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('dispensacoes')
        .select(`
          *,
          paciente:paciente_id (
            id,
            nome,
            sus_cpf,
            endereco,
            bairro,
            telefone,
            nascimento,
            idade,
            is_health_worker,
            sector
          ),
          produto:produto_id (
            descricao,
            codigo,
            unidade_medida
          )
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por paciente
      const pacientesMap = new Map<string, PatientWithDispensations>();
      
      data?.forEach((dispensacao) => {
        if (!dispensacao.paciente) return;
        
        const pacienteId = dispensacao.paciente.id;
        const paciente = dispensacao.paciente;
        
        // Filtrar por busca se especificado
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const matchesName = paciente.nome.toLowerCase().includes(searchLower);
          const matchesSusCpf = paciente.sus_cpf.toLowerCase().includes(searchLower);
          
          if (!matchesName && !matchesSusCpf) return;
        }
        
        if (!pacientesMap.has(pacienteId)) {
          pacientesMap.set(pacienteId, {
            id: paciente.id,
            nome: paciente.nome,
            sus_cpf: paciente.sus_cpf,
            endereco: paciente.endereco,
            bairro: paciente.bairro,
            telefone: paciente.telefone,
            nascimento: paciente.nascimento,
            idade: paciente.idade,
            is_health_worker: (paciente as any).is_health_worker,
            sector: (paciente as any).sector,
            dispensacoes: [],
            total_produtos_diferentes: 0,
            total_quantidade_dispensada: 0
          });
        }
        
        const pacienteData = pacientesMap.get(pacienteId)!;
        pacienteData.dispensacoes.push(dispensacao as Dispensation);
      });
      
      // Calcular totais para cada paciente
      pacientesMap.forEach((paciente) => {
        const produtosUnicos = new Set();
        let totalQuantidade = 0;
        
        paciente.dispensacoes.forEach((dispensacao) => {
          produtosUnicos.add(dispensacao.produto_id);
          // Apenas dispensações TOTAIS afetam a quantidade total subtraída
          if (!dispensacao.is_parcial) {
            totalQuantidade += dispensacao.quantidade;
          }
        });
        
        paciente.total_produtos_diferentes = produtosUnicos.size;
        paciente.total_quantidade_dispensada = totalQuantidade;
      });
      
      return Array.from(pacientesMap.values());
    },
  });

  if (isLoading) {
    return <div className="text-center py-4">Carregando dispensações por paciente/receptor...</div>;
  }

  if (!pacientesComDispensacoes?.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        {searchTerm ? 'Nenhum paciente/receptor encontrado com o termo buscado' : 'Nenhuma dispensação encontrada'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pacientesComDispensacoes.map((paciente) => (
        <Card key={paciente.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="text-lg font-semibold text-foreground">{paciente.nome}</div>
                  <div className="text-sm text-muted-foreground">SUS/CPF: {paciente.sus_cpf}</div>
                </div>
              </div>
              {paciente.is_health_worker && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-none flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  Receptor: {paciente.sector}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Resumo do paciente/receptor */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Produtos Diferentes</p>
                  <p className="font-semibold">{paciente.total_produtos_diferentes}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Dispensações</p>
                  <p className="font-semibold">{paciente.dispensacoes.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Quantidade Total</p>
                  <p className="font-semibold">{paciente.total_quantidade_dispensada}</p>
                </div>
              </div>
            </div>

            {/* Tabela de dispensações */}
            <div className="md:hidden space-y-3">
              {paciente.dispensacoes.map((dispensacao) => (
                <div key={dispensacao.id} className="border rounded-lg p-3 bg-muted/50 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-muted-foreground">
                      {formatarData(dispensacao.data_dispensa)}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "text-[10px] w-fit",
                          dispensacao.is_parcial && "bg-amber-500 hover:bg-amber-600 text-white border-none"
                        )}
                      >
                        {dispensacao.is_parcial ? (
                          <><AlertTriangle className="h-3 w-3 mr-1" /> Parcial</>
                        ) : (
                          <><TrendingDown className="h-3 w-3 mr-1" /> Total</>
                        )}
                      </Badge>
                      {dispensacao.is_servidor && (
                        <Badge variant="outline" className="text-[9px] w-fit border-blue-500 text-blue-500 bg-blue-500/5">
                          Servidor
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-bold uppercase">{dispensacao.produto?.descricao}</p>
                    <div className="flex justify-between items-end mt-1">
                      <div className="flex gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Qtd: </span>
                          <span className={cn(
                            "font-bold",
                            dispensacao.is_parcial && "text-amber-600"
                          )}>
                            {dispensacao.is_parcial && "!"} {dispensacao.quantidade}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Lote: </span>
                          <span className="font-medium">{dispensacao.lote}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {dispensacao.produto?.unidade_medida}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">Data</TableHead>
                    <TableHead className="min-w-[120px]">Tipo</TableHead>
                    <TableHead className="min-w-[150px]">Produto</TableHead>
                    <TableHead className="min-w-[80px]">Qtd</TableHead>
                    <TableHead className="min-w-[100px]">Lote</TableHead>
                    <TableHead className="min-w-[100px]">Unid. Med.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paciente.dispensacoes.map((dispensacao) => (
                    <TableRow key={dispensacao.id}>
                      <TableCell className="text-xs md:text-sm">
                        {formatarData(dispensacao.data_dispensa, 'dd/MM/yy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant="secondary" 
                            className={cn(
                              "text-[10px] w-fit",
                              dispensacao.is_parcial && "bg-amber-500 hover:bg-amber-600 text-white border-none"
                            )}
                          >
                            {dispensacao.is_parcial ? (
                              <><AlertTriangle className="h-3 w-3 mr-1" /> Parcial</>
                            ) : (
                              <><TrendingDown className="h-3 w-3 mr-1" /> Total</>
                            )}
                          </Badge>
                          {dispensacao.is_servidor && (
                            <Badge variant="outline" className="text-[9px] w-fit border-blue-500 text-blue-500 bg-blue-500/5">
                              Servidor
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs md:text-sm max-w-[150px] truncate">
                        {dispensacao.produto?.descricao}
                      </TableCell>
                      <TableCell className={cn(
                        "text-xs md:text-sm font-bold",
                        dispensacao.is_parcial && "text-amber-600"
                      )}>
                        {dispensacao.is_parcial && "!"} {dispensacao.quantidade}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {dispensacao.lote}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        <Badge variant="outline" className="text-xs">
                          {dispensacao.produto?.unidade_medida}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
