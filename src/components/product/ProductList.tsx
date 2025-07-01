
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Trash2 } from "lucide-react";
import { Product } from "@/types";
import { PermissionCheck } from "@/components/auth/PermissionCheck";

interface ProductListProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string, descricao: string) => void;
}

export function ProductList({ products, onEdit, onDelete }: ProductListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos Cadastrados ({products.length})</CardTitle>
        <CardDescription>Lista dos produtos no sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {products.length === 0 ? (
            <p className="text-gray-500 text-center py-4">Nenhum produto cadastrado.</p>
          ) : (
            products.map((product) => (
              <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{product.descricao}</p>
                  <p className="text-sm text-gray-500">
                    Código: {product.codigo} | Unidade: {product.unidade_medida}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">Estoque: {product.estoque_atual}</p>
                    <p className="text-sm text-gray-500">unidades</p>
                  </div>
                  <div className="flex gap-2">
                    <PermissionCheck 
                      permission="cadastro_produtos"
                      fallback={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(product)}
                          className="flex items-center gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Editar
                        </Button>
                      }
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(product)}
                        className="flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                    </PermissionCheck>
                    
                    <PermissionCheck 
                      permission="cadastro_produtos"
                      fallback={
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onDelete(product.id, product.descricao)}
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      }
                    >
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(product.id, product.descricao)}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    </PermissionCheck>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
