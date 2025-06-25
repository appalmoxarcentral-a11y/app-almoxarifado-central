
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, User, Package, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Product, Patient, Dispensation } from '@/types';

const MOCK_USUARIO_ID = "550e8400-e29b-41d4-a716-446655440000"; // ID temporário para teste

export function DispensationForm() {
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [lote, setLote] = useState('');
  const [dataDispensa, setDataDispensa] = useState(format(new Date(), 'yyyy-MM-dd'));

  const queryClient = useQueryClient();

  // Buscar pacientes
  const { data: pacientes } = useQuery({
    queryKey: ['pacientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      return data as Patient[];
    }
  });

  // Buscar produtos com estoque
  const { data: produtos } = useQuery({
    queryKey: ['produtos-estoque'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .gt('estoque_atual', 0)
        .order('descricao');
      
      if (error) throw error;
      return data as Product[];
    }
  });

  // Buscar dispensações recentes
  const { data: dispensacoes, isLoading: isLoadingDispensacoes } = useQuery({
    queryKey: ['dispensacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispensacoes')
        .select(`
          *,
          pacientes:paciente_id (
            nome,
            sus_cpf
          ),
          produtos:produto_id (
            descricao,
            codigo,
            unidade_medida
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as Dispensation[];
    }
  });

  // Produto selecionado para verificar estoque
  const produtoSelecionado = produtos?.find(p => p.id === selectedProduct);

  // Mutation para criar dispensação
  const createDispensationMutation = useMutation({
    mutationFn: async (dispensationData: any) => {
      const { error } = await supabase
        .from('dispensacoes')
        .insert([{
          paciente_id: dispensationData.paciente_id,
          produto_id: dispensationData.produto_id,
          quantidade: parseInt(dispensationData.quantidade),
          lote: dispensationData.lote,
          data_dispensa: dispensationData.data_dispensa,
          usuario_id: MOCK_USUARIO_ID
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Dispensação registrada!",
        description: "A dispensação foi registrada com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['dispensacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque'] });
      // Limpar formulário
      setSelectedPatient('');
      setSelectedProduct('');
      setQuantidade('');
      setLote('');
      setDataDispensa(format(new Date(), 'yyyy-MM-dd'));
    },
    onError: (error: any) => {
      if (error.message?.includes('Estoque insuficiente')) {
        toast({
          title: "Estoque insuficiente",
          description: "Não há quantidade suficiente em estoque para esta dispensação.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao registrar dispensação",
          description: "Não foi possível registrar a dispensação.",
          variant: "destructive",
        });
      }
      console.error('Erro:', error);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPatient || !selectedProduct || !quantidade || !lote) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      });
      return;
    }

    const qtd = parseInt(quantidade);
    if (produtoSelecionado && qtd > produtoSelecionado.estoque_atual) {
      toast({
        title: "Quantidade excede estoque",
        description: `Estoque disponível: ${produtoSelecionado.estoque_atual} ${produtoSelecionado.unidade_medida}`,
        variant: "destructive",
      });
      return;
    }

    createDispensationMutation.mutate({
      paciente_id: selectedPatient,
      produto_id: selectedProduct,
      quantidade,
      lote,
      data_dispensa: dataDispensa
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Dispensação</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário de Dispensação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Registrar Dispensação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="paciente">Paciente *</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {pacientes?.map((paciente) => (
                      <SelectItem key={paciente.id} value={paciente.id}>
                        {paciente.nome} - {paciente.sus_cpf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="produto">Produto *</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos?.map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        {produto.descricao} (Estoque: {produto.estoque_atual} {produto.unidade_medida})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {produtoSelecionado && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Estoque Disponível</span>
                  </div>
                  <p className="text-blue-600 mt-1">
                    {produtoSelecionado.estoque_atual} {produtoSelecionado.unidade_medida}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantidade">Quantidade *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    min="1"
                    max={produtoSelecionado?.estoque_atual || undefined}
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

              <div>
                <Label htmlFor="dataDispensa">Data da Dispensação</Label>
                <Input
                  id="dataDispensa"
                  type="date"
                  value={dataDispensa}
                  onChange={(e) => setDataDispensa(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createDispensationMutation.isPending}
              >
                {createDispensationMutation.isPending ? 'Registrando...' : 'Registrar Dispensação'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Lista de Dispensações Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Dispensações Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingDispensacoes ? (
              <div className="text-center py-4">Carregando dispensações...</div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {dispensacoes?.map((dispensacao) => (
                  <div key={dispensacao.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{dispensacao.produtos?.descricao}</p>
                        <p className="text-sm text-gray-600">
                          {dispensacao.pacientes?.nome}
                        </p>
                        <p className="text-sm text-gray-600">
                          Lote: {dispensacao.lote} | Qtd: {dispensacao.quantidade} {dispensacao.produtos?.unidade_medida}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {format(new Date(dispensacao.data_dispensa), 'dd/MM', { locale: ptBR })}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!dispensacoes || dispensacoes.length === 0) && (
                  <p className="text-center text-gray-500 py-4">
                    Nenhuma dispensação registrada ainda
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
