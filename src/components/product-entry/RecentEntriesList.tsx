
import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Edit2, Trash2 } from 'lucide-react';
import type { ProductEntry } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { EditEntryDialog } from './EditEntryDialog';
import { useProductEntryMutations } from './hooks/useProductEntryMutations';
import { ProductEntrySearch } from './ProductEntrySearch';
import { ProductEntryPagination } from './ProductEntryPagination';
import { useProductEntryQueries } from './hooks/useProductEntryQueries';

export function RecentEntriesList() {
  const { user } = useAuth();
  const { updateEntryMutation, deleteEntryMutation } = useProductEntryMutations();
  const [editingEntry, setEditingEntry] = useState<ProductEntry | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const isAdmin = user?.tipo === 'ADMIN';

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page when searching
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { entradas, isLoadingEntradas, totalCount, totalPages } = useProductEntryQueries({
    page: currentPage,
    limit: 50,
    searchTerm: debouncedSearchTerm
  });

  const handleEdit = (entry: ProductEntry) => {
    setEditingEntry(entry);
    setShowEditDialog(true);
  };

  const handleSaveEdit = (id: string, data: any) => {
    updateEntryMutation.mutate({ id, data }, {
      onSuccess: () => {
        setShowEditDialog(false);
        setEditingEntry(null);
      }
    });
  };

  const handleDelete = (id: string) => {
    deleteEntryMutation.mutate(id);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (isLoadingEntradas) {
    return <div className="text-center py-4">Carregando entradas...</div>;
  }

  return (
    <div className="space-y-4">
      <ProductEntrySearch 
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
      />

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {entradas?.map((entrada) => (
          <div key={entrada.id} className="border rounded-lg p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-medium">{entrada.produto?.descricao}</p>
                <p className="text-sm text-gray-600">
                  Lote: {entrada.lote} | Qtd: {entrada.quantidade} {entrada.produto?.unidade_medida}
                </p>
                <p className="text-xs text-gray-500">
                  Venc: {format(new Date(entrada.vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {format(new Date(entrada.data_entrada), 'dd/MM', { locale: ptBR })}
                </Badge>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(entrada)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir esta entrada?
                            <br />
                            <strong>Produto:</strong> {entrada.produto?.descricao}
                            <br />
                            <strong>Quantidade:</strong> {entrada.quantidade} {entrada.produto?.unidade_medida}
                            <br />
                            <strong>Lote:</strong> {entrada.lote}
                            <br />
                            <br />
                            Esta ação não pode ser desfeita e o estoque será ajustado automaticamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(entrada.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {(!entradas || entradas.length === 0) && (
          <p className="text-center text-gray-500 py-4">
            {searchTerm ? 'Nenhuma entrada encontrada' : 'Nenhuma entrada registrada ainda'}
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <ProductEntryPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={handlePageChange}
        />
      )}

      <EditEntryDialog
        entry={editingEntry}
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEdit}
        isLoading={updateEntryMutation.isPending}
      />
    </div>
  );
}
