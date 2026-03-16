
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
    queryKey: ['produtos-em-estoque-unidade'],
    queryFn: async () => {
      // 1. Obter a unidade atual do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('unidade_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const unidadeId = profile?.unidade_id;

      // 2. Buscar todos os produtos do catálogo
      const { data: produtosData, error: prodError } = await supabase
        .from('produtos')
        .select('id, codigo, descricao, unidade_medida');
      
      if (prodError) throw prodError;

      // 3. Calcular estoque real desta unidade para cada produto
      if (unidadeId && produtosData) {
        const produtosComEstoqueReal = await Promise.all(produtosData.map(async (produto) => {
          // Buscar soma de entradas nesta unidade
          const { data: entradas } = await supabase
            .from('entradas_produtos')
            .select('quantidade')
            .eq('produto_id', produto.id)
            .eq('unidade_id', unidadeId);
          
          const totalEntradas = entradas?.reduce((sum, item) => sum + (item.quantidade || 0), 0) || 0;

          // Buscar soma de saídas nesta unidade
          const { data: dispensacoes } = await supabase
            .from('dispensacoes')
            .select('quantidade')
            .eq('produto_id', produto.id)
            .eq('unidade_id', unidadeId);
          
          const totalSaidas = dispensacoes?.reduce((sum, item) => sum + (item.quantidade || 0), 0) || 0;

          return {
            ...produto,
            estoque_atual: totalEntradas - totalSaidas
          };
        }));

        // Filtrar apenas produtos que possuem estoque (>= 1) nesta unidade
        return produtosComEstoqueReal
          .filter(p => p.estoque_atual >= 1)
          .sort((a, b) => a.estoque_atual - b.estoque_atual);
      }

      return [] as ProductWithStock[];
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
