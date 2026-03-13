
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
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>
              {searchTerm ? `Produtos Encontrados (${products.length})` : `Produtos Cadastrados (${totalProducts})`}
            </CardTitle>
            <CardDescription>
              {searchTerm 
                ? "Resultados da busca no sistema" 
                : totalProducts > 0 
                  ? `Mostrando ${startRange}-${endRange} de ${totalProducts} produtos`
                  : "Nenhum produto cadastrado no sistema"
              }
            </CardDescription>
          </div>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${isSearching ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
            <Input
              placeholder="Buscar por descrição ou código..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 h-12 w-full md:w-80"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {isSearching && products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground mt-4">Buscando na base de dados...</p>
            </div>
          ) : products.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              {searchTerm ? "Nenhum produto encontrado com o termo de busca." : "Nenhum produto cadastrado."}
            </p>
          ) : (
            products.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{product.descricao}</p>
                    {isSuperAdmin && (
                      <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-600">
                        {(product as any).tenant_name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    Código: {product.codigo} | Unidade: {product.unidade_medida}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="font-medium">Estoque: {product.estoque_atual}</p>
                    <p className="text-sm text-gray-500">unidades</p>
                  </div>
                  <div className="flex gap-2">
                    <PermissionCheck permission="cadastro_produtos">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(product)}
                        className="flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="hidden sm:inline">Editar</span>
                      </Button>
                    </PermissionCheck>
                    
                    <PermissionCheck permission="pode_excluir">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(product.id, product.descricao)}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Excluir</span>
                      </Button>
                    </PermissionCheck>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || isSearching}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>
            
            <div className="text-sm font-medium">
              Página {currentPage} de {totalPages}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isSearching}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
