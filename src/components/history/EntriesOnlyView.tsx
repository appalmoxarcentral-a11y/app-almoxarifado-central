
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { formatarData } from '@/lib/date-utils';
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
    <>
      {/* Mobile View */}
      <div className="md:hidden space-y-4">
        {entradas?.map((entrada) => (
          <div key={entrada.id} className="border rounded-lg p-4 bg-card space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-xs text-muted-foreground">
                {formatarData(entrada.data_entrada)}
              </span>
              <Badge variant="default" className="text-[10px]">
                <TrendingUp className="h-3 w-3 mr-1" /> Entrada
              </Badge>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold uppercase">{entrada.produto?.descricao}</p>
              <div className="flex flex-wrap gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Qtd: </span>
                  <span className="font-medium">{entrada.quantidade}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Lote: </span>
                  <span className="font-medium">{entrada.lote}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Vencimento:</span>
              <span className="text-xs font-medium">
                {formatarData(entrada.vencimento)}
              </span>
            </div>
          </div>
        ))}
        {(!entradas || entradas.length === 0) && (
          <div className="text-center py-8 text-gray-500 border rounded-lg">
            {searchTerm ? 'Nenhuma entrada encontrada com o termo buscado' : 'Nenhuma entrada encontrada'}
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
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
                  {formatarData(entrada.data_entrada, 'dd/MM/yy')}
                </TableCell>
                <TableCell>
                  <Badge variant="default" className="text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" /> Entrada
                  </Badge>
                </TableCell>
                <TableCell className="text-xs md:text-sm">
                  {entrada.produto?.descricao}
                </TableCell>
                <TableCell className="text-xs md:text-sm">{entrada.quantidade}</TableCell>
                <TableCell className="text-xs md:text-sm">{entrada.lote}</TableCell>
                <TableCell className="text-xs md:text-sm">
                  {formatarData(entrada.vencimento, 'dd/MM/yy')}
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
    </>
  );
}
