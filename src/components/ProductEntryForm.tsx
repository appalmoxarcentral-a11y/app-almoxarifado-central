
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, PackagePlus, Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Product, ProductEntry } from '@/types';

export function ProductEntryForm() {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [lote, setLote] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [dataEntrada, setDataEntrada] = useState(format(new Date(), 'yyyy-MM-dd'));

  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Verificar se o usuário está autenticado
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você precisa estar logado para registrar entradas.</p>
        </div>
      </div>
    );
  }

  // Buscar produtos
  const { data: produtos, isLoading: isLoadingProdutos } = useQuery({
    queryKey: ['produtos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('descricao');
      
      if (error) throw error;
      return data as Product[];
    }
  });

  // Buscar entradas recentes
  const { data: entradas, isLoading: isLoadingEntradas } = useQuery({
    queryKey: ['entradas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entradas_produtos')
        .select(`
          *,
          produto:produto_id (
            descricao,
            codigo,
            unidade_medida
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as ProductEntry[];
    }
  });

  // Mutation para criar entrada
  const createEntryMutation = useMutation({
    mutationFn: async (entryData: any) => {
      const { error } = await supabase
        .from('entradas_produtos')
        .insert([{
          produto_id: entryData.produto_id,
          quantidade: parseInt(entryData.quantidade),
          lote: entryData.lote,
          vencimento: entryData.vencimento,
          data_entrada: entryData.data_entrada,
          usuario_id: user.id // Usar o ID do usuário autenticado
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Entrada registrada!",
        description: "A entrada do produto foi registrada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      // Limpar formulário
      setSelectedProduct('');
      setQuantidade('');
      setLote('');
      setVencimento('');
      setDataEntrada(format(new Date(), 'yyyy-MM-dd'));
    },
    onError: (error) => {
      toast({
        title: "Erro ao registrar entrada",
        description: "Não foi possível registrar a entrada do produto.",
        variant: "destructive",
      });
      console.error('Erro:', error);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct || !quantidade || !lote || !vencimento) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    createEntryMutation.mutate({
      produto_id: selectedProduct,
      quantidade,
      lote,
      vencimento,
      data_entrada: dataEntrada
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <PackagePlus className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Entrada de Produtos</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário de Entrada */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Registrar Nova Entrada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="produto">Produto *</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos?.map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        {produto.descricao} ({produto.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantidade">Quantidade *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="lote">Lote *</Label>
                  <Input
                    id="lote"
                    value={lote}
                    onChange={(e) => setLote(e.target.value)}
                    placeholder="Ex: LOT001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vencimento">Data de Vencimento *</Label>
                  <Input
                    id="vencimento"
                    type="date"
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="dataEntrada">Data de Entrada</Label>
                  <Input
                    id="dataEntrada"
                    type="date"
                    value={dataEntrada}
                    onChange={(e) => setDataEntrada(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createEntryMutation.isPending}
              >
                {createEntryMutation.isPending ? 'Registrando...' : 'Registrar Entrada'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de Entradas Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Entradas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingEntradas ? (
              <div className="text-center py-4">Carregando entradas...</div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {entradas?.map((entrada) => (
                  <div key={entrada.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{entrada.produto?.descricao}</p>
                        <p className="text-sm text-gray-600">
                          Lote: {entrada.lote} | Qtd: {entrada.quantidade} {entrada.produto?.unidade_medida}
                        </p>
                        <p className="text-xs text-gray-500">
                          Venc: {format(new Date(entrada.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {format(new Date(entrada.data_entrada), 'dd/MM', { locale: ptBR })}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!entradas || entradas.length === 0) && (
                  <p className="text-center text-gray-500 py-4">
                    Nenhuma entrada registrada ainda
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
