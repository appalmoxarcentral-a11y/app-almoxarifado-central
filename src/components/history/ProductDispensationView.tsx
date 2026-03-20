
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Dispensation } from '@/types';

interface ProductDispensationViewProps {
  searchTerm: string;
  filtroDataInicial: string;
  filtroDataFinal: string;
  filtroProduto: string;
}

export function ProductDispensationView({ 
  searchTerm, 
  filtroDataInicial, 
  filtroDataFinal, 
  filtroProduto 
}: ProductDispensationViewProps) {
  const { data: dispensacoes, isLoading } = useQuery({
    queryKey: ['dispensacoes-produtos', searchTerm, filtroDataInicial, filtroDataFinal, filtroProduto],
    queryFn: async () => {
      let query = supabase
        .from('dispensacoes')
        .select(`
          *,
          paciente:paciente_id (
            nome,
            sus_cpf
          ),
          produto:produto_id (
            descricao,
            codigo,
            unidade_medida
          )
        `)
        .order('created_at', { ascending: false });

      if (filtroDataInicial) {
        query = query.gte('data_dispensa', filtroDataInicial);
      }
      if (filtroDataFinal) {
        query = query.lte('data_dispensa', filtroDataFinal);
      }
      if (filtroProduto && filtroProduto !== 'all') {
        query = query.eq('produto_id', filtroProduto);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filtrar por nome do produto ou lote se especificado
      let filteredData = data as Dispensation[];
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredData = filteredData.filter(dispensacao => 
          dispensacao.produto?.descricao.toLowerCase().includes(searchLower) ||
          dispensacao.lote.toLowerCase().includes(searchLower)
        );
      }
      
      return filteredData;
    },
  });

  if (isLoading) {
    return <div className="text-center py-4">Carregando dispensações de produtos...</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[100px]">Data</TableHead>
            <TableHead className="min-w-[120px]">Tipo</TableHead>
            <TableHead className="min-w-[150px]">Produto</TableHead>
            <TableHead className="min-w-[80px]">Qtd</TableHead>
            <TableHead className="min-w-[100px]">Lote</TableHead>
            <TableHead className="min-w-[120px]">Paciente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dispensacoes?.map((dispensacao) => (
            <TableRow key={dispensacao.id}>
              <TableCell className="text-xs md:text-sm">
                {format(new Date(dispensacao.data_dispensa), 'dd/MM/yy', { locale: ptBR })}
              </TableCell>
              <TableCell>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-xs",
                    dispensacao.is_parcial && "bg-amber-500 hover:bg-amber-600 text-white border-none"
                  )}
                >
                  {dispensacao.is_parcial ? (
                    <><AlertTriangle className="h-3 w-3 mr-1" /> Parcial</>
                  ) : (
                    <><TrendingDown className="h-3 w-3 mr-1" /> Dispensação</>
                  )}
                </Badge>
              </TableCell>
              <TableCell className="text-xs md:text-sm max-w-[150px] truncate">
                {dispensacao.produto?.descricao}
              </TableCell>
              <TableCell className={cn(
                "text-xs md:text-sm font-medium",
                dispensacao.is_parcial && "text-amber-600"
              )}>
                {dispensacao.is_parcial && "!"} {dispensacao.quantidade}
              </TableCell>
              <TableCell className="text-xs md:text-sm">{dispensacao.lote}</TableCell>
              <TableCell className="text-xs md:text-sm max-w-[120px] truncate">
                {dispensacao.paciente?.nome || '-'}
              </TableCell>
            </TableRow>
          ))}
          {(!dispensacoes || dispensacoes.length === 0) && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                {searchTerm ? 'Nenhuma dispensação encontrada com o termo buscado' : 'Nenhuma dispensação encontrada'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
