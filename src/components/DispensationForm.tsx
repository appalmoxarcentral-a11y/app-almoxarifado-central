
import React, { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { PatientSelection } from './dispensation/PatientSelection';
import { ProductCart } from './dispensation/ProductCart';
import { ProductSelection } from './dispensation/ProductSelection';
import { RecentDispensations } from './dispensation/RecentDispensations';
import { useDispensationQueries } from './dispensation/hooks/useDispensationQueries';
import { useDispensationMutations } from './dispensation/hooks/useDispensationMutations';
import type { Product } from '@/types';

interface CarrinhoItem {
  produto: Product;
  quantidade: number;
  lote: string;
}

export function DispensationForm() {
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [selectedLote, setSelectedLote] = useState('');
  const [dataDispensa, setDataDispensa] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);

  const {
    pacientes,
    produtos,
    lotes,
    dispensacoes,
    isLoadingDispensacoes
  } = useDispensationQueries(selectedProduct);

  const handleSuccessfulDispensation = () => {
    setCarrinho([]);
    setSelectedPatient('');
    setSelectedProduct('');
    setQuantidade('');
    setSelectedLote('');
    setDataDispensa(format(new Date(), 'yyyy-MM-dd'));
  };

  const { createDispensationMutation } = useDispensationMutations(
    selectedPatient,
    dataDispensa,
    handleSuccessfulDispensation
  );

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
    setSelectedLote('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Dispensação Múltipla</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PatientSelection
          selectedPatient={selectedPatient}
          setSelectedPatient={setSelectedPatient}
          dataDispensa={dataDispensa}
          setDataDispensa={setDataDispensa}
          pacientes={pacientes}
        />

        <ProductCart
          carrinho={carrinho}
          onRemoveItem={removerDoCarrinho}
          onConfirmDispensation={confirmarDispensacao}
          selectedPatient={selectedPatient}
          isProcessing={createDispensationMutation.isPending}
        />

        <ProductSelection
          selectedProduct={selectedProduct}
          onProductChange={handleProductChange}
          selectedLote={selectedLote}
          setSelectedLote={setSelectedLote}
          quantidade={quantidade}
          setQuantidade={setQuantidade}
          produtos={produtos}
          lotes={lotes}
          onAddToCart={adicionarAoCarrinho}
        />

        <RecentDispensations
          dispensacoes={dispensacoes}
          isLoading={isLoadingDispensacoes}
        />
      </div>
    </div>
  );
}
