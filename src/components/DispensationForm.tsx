
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, User, Package, AlertTriangle, Plus, Trash2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import type { Product, Patient, Dispensation } from '@/types';

interface CarrinhoItem {
  produto: Product;
  quantidade: number;
  lote: string;
}

interface LoteInfo {
  lote: string;
  vencimento: string;
  created_at: string;
}

export function DispensationForm() {
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [selectedLote, setSelectedLote] = useState('');
  const [dataDispensa, setDataDispensa] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);

  const { user } = useAuth();
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

  // Buscar lotes do produto selecionado
  const { data: lotes } = useQuery({
    queryKey: ['lotes-produto', selectedProduct],
    enabled: !!selectedProduct,
    queryFn: async () => {
      if (!selectedProduct) return [];
      
      const { data, error } = await supabase
        .from('entradas_produtos')
        .select('lote, vencimento, created_at')
        .eq('produto_id', selectedProduct)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Remover lotes duplicados mantendo o mais antigo
      const lotesUnicos = data.reduce((acc: LoteInfo[], current) => {
        const existingLote = acc.find(item => item.lote === current.lote);
        if (!existingLote) {
          acc.push(current);
        }
        return acc;
      }, []);
      
      return lotesUnicos as LoteInfo[];
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
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as Dispensation[];
    }
  });

  // Produto selecionado para verificar estoque
  const produtoSelecionado = produtos?.find(p => p.id === selectedProduct);
  const pacienteSelecionado = pacientes?.find(p => p.id === selectedPatient);

  // Mutation para dispensação múltipla
  const createDispensationMutation = useMutation({
    mutationFn: async (items: CarrinhoItem[]) => {
      if (!selectedPatient || !user) {
        throw new Error('Paciente ou usuário não selecionado');
      }

      // Criar todas as dispensações
      const dispensationsToCreate = items.map(item => ({
        paciente_id: selectedPatient,
        produto_id: item.produto.id,
        quantidade: item.quantidade,
        lote: item.lote,
        data_dispensa: dataDispensa,
        usuario_id: user.id
      }));

      const { error } = await supabase
        .from('dispensacoes')
        .insert(dispensationsToCreate);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Dispensações registradas!",
        description: `${carrinho.length} produto(s) foram dispensados com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['dispensacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque'] });
      // Limpar carrinho e formulário
      setCarrinho([]);
      setSelectedPatient('');
      setSelectedProduct('');
      setQuantidade('');
      setSelectedLote('');
      setDataDispensa(format(new Date(), 'yyyy-MM-dd'));
    },
    onError: (error: any) => {
      if (error.message?.includes('Estoque insuficiente')) {
        toast({
          title: "Estoque insuficiente",
          description: "Não há quantidade suficiente em estoque para algum produto.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao registrar dispensações",
          description: "Não foi possível registrar as dispensações.",
          variant: "destructive",
        });
      }
      console.error('Erro:', error);
    }
  });

  const adicionarAoCarrinho = () => {
    if (!selectedProduct || !quantidade || !selectedLote) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione produto, quantidade e lote.",
        variant: "destructive",
      });
      return;
    }

    const produto = produtos?.find(p => p.id === selectedProduct);
    if (!produto) return;

    const qtd = parseInt(quantidade);
    if (qtd > produto.estoque_atual) {
      toast({
        title: "Quantidade excede estoque",
        description: `Estoque disponível: ${produto.estoque_atual} ${produto.unidade_medida}`,
        variant: "destructive",
      });
      return;
    }

    // Verificar se produto já está no carrinho
    const produtoJaNoCarrinho = carrinho.find(item => 
      item.produto.id === selectedProduct && item.lote === selectedLote
    );

    if (produtoJaNoCarrinho) {
      toast({
        title: "Produto já adicionado",
        description: "Este produto com o mesmo lote já está no carrinho.",
        variant: "destructive",
      });
      return;
    }

    const novoItem: CarrinhoItem = {
      produto,
      quantidade: qtd,
      lote: selectedLote
    };

    setCarrinho(prev => [...prev, novoItem]);
    
    // Limpar campos do produto
    setSelectedProduct('');
    setQuantidade('');
    setSelectedLote('');

    toast({
      title: "Produto adicionado!",
      description: "Produto adicionado ao carrinho.",
    });
  };

  const removerDoCarrinho = (index: number) => {
    setCarrinho(prev => prev.filter((_, i) => i !== index));
  };

  const confirmarDispensacao = () => {
    if (!selectedPatient) {
      toast({
        title: "Paciente não selecionado",
        description: "Selecione um paciente antes de confirmar.",
        variant: "destructive",
      });
      return;
    }

    if (carrinho.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione pelo menos um produto ao carrinho.",
        variant: "destructive",
      });
      return;
    }

    createDispensationMutation.mutate(carrinho);
  };

  // Limpar lote quando produto muda
  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId);
    setSelectedLote(''); // Limpar lote selecionado quando produto muda
  };

  const totalItensCarrinho = carrinho.reduce((total, item) => total + item.quantidade, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Dispensação Múltipla</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Seleção de Paciente */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              1. Selecionar Paciente
            </CardTitle>
          </CardHeader>
          <CardContent>
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

            {pacienteSelecionado && (
              <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700">
                  <User className="h-4 w-4" />
                  <span className="font-medium">Paciente Selecionado</span>
                </div>
                <p className="text-blue-600 mt-1">
                  {pacienteSelecionado.nome} - {pacienteSelecionado.sus_cpf}
                </p>
              </div>
            )}

            <div className="mt-4">
              <Label htmlFor="dataDispensa">Data da Dispensação</Label>
              <Input
                id="dataDispensa"
                type="date"
                value={dataDispensa}
                onChange={(e) => setDataDispensa(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Carrinho */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Carrinho ({totalItensCarrinho} itens)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {carrinho.map((item, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.produto.descricao}</p>
                      <p className="text-xs text-gray-600">
                        Lote: {item.lote}
                      </p>
                      <p className="text-xs text-gray-600">
                        Qtd: {item.quantidade} {item.produto.unidade_medida}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removerDoCarrinho(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {carrinho.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Carrinho vazio
                </p>
              )}
            </div>

            {carrinho.length > 0 && (
              <Button
                className="w-full mt-4"
                onClick={confirmarDispensacao}
                disabled={createDispensationMutation.isPending || !selectedPatient}
              >
                {createDispensationMutation.isPending 
                  ? 'Processando...' 
                  : `Confirmar Dispensação (${carrinho.length} produtos)`
                }
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Adicionar Produtos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              2. Adicionar Produtos ao Carrinho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="produto">Produto *</Label>
                <Select value={selectedProduct} onValueChange={handleProductChange}>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lote">Lote *</Label>
                  <Select 
                    value={selectedLote} 
                    onValueChange={setSelectedLote}
                    disabled={!selectedProduct}
                  >
                    <SelectTrigger>
                      <SelectValue 
                        placeholder={
                          !selectedProduct 
                            ? "Selecione um produto primeiro" 
                            : "Selecione um lote"
                        } 
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {lotes?.map((loteInfo) => (
                        <SelectItem key={loteInfo.lote} value={loteInfo.lote}>
                          <div className="flex flex-col">
                            <span className="font-medium">{loteInfo.lote}</span>
                            <span className="text-xs text-gray-500">
                              Vence: {format(new Date(loteInfo.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProduct && lotes?.length === 0 && (
                    <p className="text-sm text-yellow-600 mt-1">
                      Nenhum lote encontrado para este produto
                    </p>
                  )}
                </div>
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
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={adicionarAoCarrinho}
                disabled={!selectedProduct || !quantidade || !selectedLote}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar ao Carrinho
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dispensações Recentes */}
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
                        <p className="font-medium text-sm">{dispensacao.produto?.descricao}</p>
                        <p className="text-xs text-gray-600">
                          {dispensacao.paciente?.nome}
                        </p>
                        <p className="text-xs text-gray-600">
                          Lote: {dispensacao.lote} | Qtd: {dispensacao.quantidade} {dispensacao.produto?.unidade_medida}
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
