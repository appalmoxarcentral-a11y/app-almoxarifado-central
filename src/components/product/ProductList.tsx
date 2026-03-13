
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Product } from "@/types";
import { PermissionCheck } from "@/components/auth/PermissionCheck";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ProductListProps {
  products: Product[];
  totalProducts: number;
  isSearching: boolean;
  searchTerm: string;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSearchChange: (value: string) => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string, descricao: string) => void;
}

export function ProductList({ 
  products, 
  totalProducts, 
  isSearching, 
  searchTerm, 
  currentPage,
  pageSize,
  onPageChange,
  onSearchChange, 
  onEdit, 
  onDelete 
}: ProductListProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';

  const totalPages = Math.ceil(totalProducts / pageSize);
  const startRange = (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, totalProducts);

  return (
    <Card className="border-border bg-card shadow-lg rounded-2xl md:rounded-3xl overflow-hidden">
      <CardHeader className="p-5 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1">
            <CardTitle className="text-xl md:text-2xl font-black tracking-tight">
              {searchTerm ? `Produtos Encontrados (${products.length})` : `Produtos Cadastrados (${totalProducts})`}
            </CardTitle>
            <CardDescription className="text-xs md:text-sm font-medium">
              {searchTerm 
                ? "Resultados da busca no sistema" 
                : totalProducts > 0 
                  ? `Mostrando ${startRange}-${endRange} de ${totalProducts} produtos`
                  : "Nenhum produto cadastrado no sistema"
              }
            </CardDescription>
          </div>
          <div className="relative w-full md:w-80">
            <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 ${isSearching ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            <Input
              placeholder="Buscar por descrição ou código..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-12 h-12 w-full text-[16px] bg-muted/20 border-border focus:bg-background transition-all rounded-xl"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 md:p-8 md:pt-0 space-y-4">
        <div className="divide-y divide-border border-t md:border-none">
          {isSearching && products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              <p className="text-muted-foreground mt-4 font-bold text-sm">Buscando na base...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground font-medium italic">
                {searchTerm ? "Nenhum produto encontrado." : "Nenhum produto cadastrado."}
              </p>
            </div>
          ) : (
            products.map((product) => (
              <div key={product.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 md:p-6 md:border md:rounded-2xl hover:bg-muted/30 transition-all gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center flex-wrap gap-2">
                    <p className="font-black text-base md:text-lg text-foreground leading-tight">{product.descricao}</p>
                    {isSuperAdmin && (
                      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/30 text-primary bg-primary/5">
                        {(product as any).tenant_name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">COD: {product.codigo}</span>
                    <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">UNID: {product.unidade_medida}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-none pt-4 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg md:text-xl font-black text-primary">{product.estoque_atual}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">unidades</span>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 hidden sm:block">Estoque Atual</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <PermissionCheck permission="cadastro_produtos">
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => onEdit(product)}
                        className="h-10 w-10 md:h-11 md:w-auto md:px-4 rounded-xl shadow-sm"
                      >
                        <Edit className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline font-bold">Editar</span>
                      </Button>
                    </PermissionCheck>
                    
                    <PermissionCheck permission="pode_excluir">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => onDelete(product.id, product.descricao)}
                        className="h-10 w-10 md:h-11 md:w-auto md:px-4 rounded-xl shadow-sm"
                      >
                        <Trash2 className="h-5 w-5 md:mr-2" />
                        <span className="hidden md:inline font-bold">Excluir</span>
                      </Button>
                    </PermissionCheck>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-5 md:p-0 pt-4 md:pt-8 border-t md:border-none">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || isSearching}
              className="h-10 px-4 font-bold rounded-xl"
            >
              <ChevronLeft className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden xs:inline">Anterior</span>
            </Button>
            
            <div className="text-xs md:text-sm font-black uppercase tracking-widest text-muted-foreground">
              Pág. {currentPage} / {totalPages}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isSearching}
              className="h-10 px-4 font-bold rounded-xl"
            >
              <span className="hidden xs:inline text-sm">Próximo</span>
              <ChevronRight className="h-4 w-4 ml-1 md:ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
