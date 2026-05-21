
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
import { buildLotBalancesByProduct, normalizeLotLabel } from '@/components/purchase-report/lot-balance-utils';

interface ProductLotWithStock {
  id: string;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  lote: string;
  vencimento: string;
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

      if (!unidadeId) {
        return [] as ProductLotWithStock[];
      }

      // 2. Buscar todos os produtos do catálogo
      const { data: produtosData, error: prodError } = await supabase
        .from('produtos')
        .select('id, codigo, descricao, unidade_medida');
      
      if (prodError) throw prodError;

      const produtoIds = produtosData?.map(produto => produto.id) || [];
      if (produtoIds.length === 0) {
        return [] as ProductLotWithStock[];
      }

      // 3. Buscar entradas e saídas da unidade e calcular saldo por lote
      const [{ data: entradas, error: entradasError }, { data: dispensacoes, error: dispensacoesError }] = await Promise.all([
        supabase
          .from('entradas_produtos')
          .select('produto_id, lote, vencimento, quantidade')
          .eq('unidade_id', unidadeId)
          .in('produto_id', produtoIds),
        supabase
          .from('dispensacoes')
          .select('produto_id, lote, quantidade')
          .eq('unidade_id', unidadeId)
          .in('produto_id', produtoIds)
      ]);

      if (entradasError) throw entradasError;
      if (dispensacoesError) throw dispensacoesError;

      const productMap = new Map(produtosData.map(produto => [produto.id, produto]));
      const balancesByProduct = buildLotBalancesByProduct(entradas || [], dispensacoes || []);
      const rows: ProductLotWithStock[] = [];

      for (const [produtoId, lots] of balancesByProduct.entries()) {
        const produto = productMap.get(produtoId);
        if (!produto) continue;

        for (const lot of lots) {
          rows.push({
            ...produto,
            lote: lot.lote,
            vencimento: lot.vencimento,
            estoque_atual: lot.quantidade
          });
        }
      }

      const groupedRows = new Map<string, ProductLotWithStock[]>();

      rows.forEach(row => {
        const existing = groupedRows.get(row.codigo) || [];
        existing.push(row);
        groupedRows.set(row.codigo, existing);
      });

      const sortedGroups = Array.from(groupedRows.values())
        .map(group => group.sort((a, b) =>
          a.estoque_atual - b.estoque_atual ||
          normalizeLotLabel(a.lote).localeCompare(normalizeLotLabel(b.lote), 'pt-BR', { sensitivity: 'base' }) ||
          a.vencimento.localeCompare(b.vencimento)
        ))
        .sort((groupA, groupB) =>
          groupA[0].estoque_atual - groupB[0].estoque_atual ||
          groupA[0].codigo.localeCompare(groupB[0].codigo, 'pt-BR', { sensitivity: 'base' }) ||
          groupA[0].descricao.localeCompare(groupB[0].descricao, 'pt-BR', { sensitivity: 'base' })
        );

      return sortedGroups.flat();
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
          Produtos em Estoque ({produtosEmEstoque?.length || 0} lotes)
        </h3>
      </div>
      
      <div className="md:hidden space-y-4">
        {produtosEmEstoque?.map((produto) => (
          <div key={produto.id} className="border rounded-lg p-4 bg-card space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-xs font-mono text-muted-foreground">{produto.codigo}</span>
              <Badge 
                variant={produto.estoque_atual <= 10 ? 'destructive' : produto.estoque_atual <= 50 ? 'secondary' : 'default'}
                className="text-[10px]"
              >
                {produto.estoque_atual <= 10 ? 'Estoque Baixo' : 
                 produto.estoque_atual <= 50 ? 'Estoque Médio' : 'Estoque OK'}
              </Badge>
            </div>
            
            <div>
              <p className="text-sm font-bold uppercase">{produto.descricao}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Lote: <span className="font-medium text-foreground">{produto.lote}</span>
              </p>
              <div className="flex justify-between items-end mt-2">
                <div className="text-xs text-muted-foreground">
                  Unidade: <span className="font-medium text-foreground">{produto.unidade_medida}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">Estoque Atual</span>
                  <span className="text-lg font-bold text-blue-600">{produto.estoque_atual}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        {(!produtosEmEstoque || produtosEmEstoque.length === 0) && (
          <div className="text-center py-8 text-gray-500 border rounded-lg">
            Nenhum produto em estoque encontrado
          </div>
        )}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">Código</TableHead>
              <TableHead className="min-w-[200px]">Produto</TableHead>
              <TableHead className="min-w-[120px]">Lote</TableHead>
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
                <TableCell className="text-xs md:text-sm font-mono">
                  {produto.lote}
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
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
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
