import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ShoppingCart } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { PatientSelection } from './dispensation/PatientSelection';
import { ProductCart } from './dispensation/ProductCart';
import { ProductSelection } from './dispensation/ProductSelection';
import { RecentDispensations } from './dispensation/RecentDispensations';
import { useDispensationQueries } from './dispensation/hooks/useDispensationQueries';
import { useDispensationMutations } from './dispensation/hooks/useDispensationMutations';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/types';

interface CarrinhoItem {
  produto: Product;
  quantidade: number;
  lote: string;
}

export function DispensationForm() {
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedProductData, setSelectedProductData] = useState<Product | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [selectedLote, setSelectedLote] = useState('');
  const [dataDispensa, setDataDispensa] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tipoDispensacao, setTipoDispensacao] = useState('');
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [procedureSearch, setProcedureSearch] = useState('');
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const {
    pacientes,
    procedimentos,
    produtos,
    lotes,
    dispensacoes,
    isLoadingDispensacoes
  } = useDispensationQueries(
    selectedProduct, 
    patientSearch, 
    productSearch,
    procedureSearch,
    user?.unidade_id,
    user?.tenant_id
  );

  const handleSuccessfulDispensation = () => {
    setCarrinho([]);
    setSelectedPatient('');
    setSelectedProduct('');
    setSelectedProductData(null);
    setQuantidade('');
    setSelectedLote('');
    setDataDispensa(format(new Date(), 'yyyy-MM-dd'));
    setTipoDispensacao('');
    setCartOpen(false);
  };

  const { createDispensationMutation, deleteDispensationMutation } = useDispensationMutations(
    selectedPatient,
    dataDispensa,
    tipoDispensacao,
    handleSuccessfulDispensation
  );

  const handleDeleteDispensation = (id: string) => {
    deleteDispensationMutation.mutate(id);
  };

  const adicionarAoCarrinho = () => {
    if (!selectedProduct || !quantidade || !selectedLote) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione produto, quantidade e lote.",
        variant: "destructive",
      });
      return;
    }

    // Usar selectedProductData se disponível, senão buscar na lista atual
    const produto = selectedProductData || produtos?.find(p => p.id === selectedProduct);
    
    if (!produto) {
      toast({
        title: "Erro ao adicionar",
        description: "Produto não encontrado. Tente buscar e selecionar novamente.",
        variant: "destructive",
      });
      return;
    }

    const qtd = parseInt(quantidade);

    if (qtd > (produto.estoque_atual || 0)) {
      toast({
        title: "Quantidade excede estoque",
        description: `Estoque disponível: ${produto.estoque_atual || 0} ${produto.unidade_medida}`,
        variant: "destructive",
      });
      return;
    }

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

    // Limpar apenas campos de seleção de produto
    setSelectedProduct('');
    setSelectedProductData(null);
    setQuantidade('');
    setSelectedLote('');
    setProductSearch('');

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

  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId);
    setSelectedLote('');
    
    // Buscar e salvar o objeto do produto imediatamente
    const product = produtos?.find(p => p.id === productId);
    if (product) {
      setSelectedProductData(product);
    }
  };

  const totalItensCarrinho = carrinho.reduce((total, item) => total + item.quantidade, 0);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="space-y-4">
        {/* Mobile Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Dispensação Múltipla</h1>
            <p className="text-xs text-muted-foreground">Gerencie dispensações</p>
          </div>
        </div>

        {/* Step 1: Patient */}
        <PatientSelection
          selectedPatient={selectedPatient}
          setSelectedPatient={setSelectedPatient}
          dataDispensa={dataDispensa}
          setDataDispensa={setDataDispensa}
          tipoDispensacao={tipoDispensacao}
          setTipoDispensacao={setTipoDispensacao}
          pacientes={pacientes}
          procedimentos={procedimentos}
          onSearchChange={setPatientSearch}
          onProcedureSearchChange={setProcedureSearch}
        />

        {/* Step 2: Products */}
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
          onSearchChange={setProductSearch}
        />

        {/* Recent Dispensations */}
        <RecentDispensations
          dispensacoes={dispensacoes}
          isLoading={isLoadingDispensacoes}
          onDelete={handleDeleteDispensation}
        />

        {/* Floating Cart Button */}
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <button className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform">
              <ShoppingCart className="h-6 w-6" />
              {carrinho.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center text-[10px] p-0 bg-destructive text-destructive-foreground">
                  {carrinho.length}
                </Badge>
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrinho ({totalItensCarrinho} itens)
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <ProductCart
                carrinho={carrinho}
                onRemoveItem={removerDoCarrinho}
                onConfirmDispensation={confirmarDispensacao}
                selectedPatient={selectedPatient}
                isProcessing={createDispensationMutation.isPending}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop layout (unchanged)
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
          tipoDispensacao={tipoDispensacao}
          setTipoDispensacao={setTipoDispensacao}
          pacientes={pacientes}
          procedimentos={procedimentos}
          onSearchChange={setPatientSearch}
          onProcedureSearchChange={setProcedureSearch}
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
          onSearchChange={setProductSearch}
        />

        <RecentDispensations
          dispensacoes={dispensacoes}
          isLoading={isLoadingDispensacoes}
          onDelete={handleDeleteDispensation}
        />
      </div>
    </div>
  );
}
