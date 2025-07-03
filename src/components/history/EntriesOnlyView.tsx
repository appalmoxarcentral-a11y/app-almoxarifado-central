
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ProductEntry } from '@/types';

interface EntriesOnlyViewProps {
  searchTerm: string;
  filtroDataInicial: string;
  filtroDataFinal: string;
  filtroProduto: string;
}

export function EntriesOnlyView({ 
  searchTerm, 
  filtroDataInicial, 
  filtroDataFinal, 
  filtroProduto 
}: EntriesOnlyViewProps) {
  const { data: entradas, isLoading } = useQuery({
    queryKey: ['entradas-apenas', searchTerm, filtroDataInicial, filtroDataFinal, filtroProduto],
    queryFn: async () => {
      let query = supabase
        .from('entradas_produtos')
        .select(`
          *,
          produto:produto_id (
            descricao,
            codigo,
            unidade_medida
          )
        `)
        .order('created_at', { ascending: false });

      if (filtroDataInicial) {
        query = query.gte('data_entrada', filtroDataInicial);
      }
      if (filtroDataFinal) {
        query = query.lte('data_entrada', filtroDataFinal);
      }
      if (filtroProduto && filtroProduto !== 'all') {
        query = query.eq('produto_id', filtroProduto);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filtrar por nome do produto ou lote se especificado
      let filteredData = data as ProductEntry[];
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredData = filteredData.filter(entrada => 
          entrada.produto?.descricao.toLowerCase().includes(searchLower) ||
          entrada.lote.toLowerCase().includes(searchLower)
        );
      }
      
      return filteredData;
    },
  });

  if (isLoading) {
    return <div className="text-center py-4">Carregando entradas de produtos...</div>;
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
            <TableHead className="min-w-[120px]">Vencimento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entradas?.map((entrada) => (
            <TableRow key={entrada.id}>
              <TableCell className="text-xs md:text-sm">
                {format(new Date(entrada.data_entrada), 'dd/MM/yy', { locale: ptBR })}
              </TableCell>
              <TableCell>
                <Badge variant="default" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" /> Entrada
                </Badge>
              </TableCell>
              <TableCell className="text-xs md:text-sm max-w-[150px] truncate">
                {entrada.produto?.descricao}
              </TableCell>
              <TableCell className="text-xs md:text-sm">{entrada.quantidade}</TableCell>
              <TableCell className="text-xs md:text-sm">{entrada.lote}</TableCell>
              <TableCell className="text-xs md:text-sm">
                {format(new Date(entrada.vencimento), 'dd/MM/yy', { locale: ptBR })}
              </TableCell>
            </TableRow>
          ))}
          {(!entradas || entradas.length === 0) && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                {searchTerm ? 'Nenhuma entrada encontrada com o termo buscado' : 'Nenhuma entrada encontrada'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
