
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

interface ProductWithStock {
  id: string;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  estoque_atual: number;
}

export function StockOnlyTable() {
  const { data: produtosEmEstoque, isLoading } = useQuery({
    queryKey: ['produtos-em-estoque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, descricao, unidade_medida, estoque_atual')
        .gte('estoque_atual', 1)
        .order('estoque_atual', { ascending: true });
      
      if (error) throw error;
      return data as ProductWithStock[];
    },
  });

  if (isLoading) {
    return <div className="text-center py-4">Carregando produtos em estoque...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">
          Produtos em Estoque ({produtosEmEstoque?.length || 0} produtos)
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">Código</TableHead>
              <TableHead className="min-w-[200px]">Produto</TableHead>
              <TableHead className="min-w-[80px]">Estoque</TableHead>
              <TableHead className="min-w-[100px]">Unidade</TableHead>
              <TableHead className="min-w-[100px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {produtosEmEstoque?.map((produto) => (
              <TableRow key={produto.id}>
                <TableCell className="text-xs md:text-sm font-mono">
                  {produto.codigo}
                </TableCell>
                <TableCell className="text-xs md:text-sm">
                  {produto.descricao}
                </TableCell>
                <TableCell className="text-xs md:text-sm font-semibold">
                  {produto.estoque_atual}
                </TableCell>
                <TableCell className="text-xs md:text-sm">
                  {produto.unidade_medida}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={produto.estoque_atual <= 10 ? 'destructive' : produto.estoque_atual <= 50 ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {produto.estoque_atual <= 10 ? 'Estoque Baixo' : 
                     produto.estoque_atual <= 50 ? 'Estoque Médio' : 'Estoque OK'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {(!produtosEmEstoque || produtosEmEstoque.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  Nenhum produto em estoque encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
