
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductEntryPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function ProductEntryPagination({ 
  currentPage, 
  totalPages, 
  totalCount, 
  onPageChange 
}: ProductEntryPaginationProps) {
  const startEntry = (currentPage - 1) * 50 + 1;
  const endEntry = Math.min(currentPage * 50, totalCount);

  return (
    <div className="flex items-center justify-between px-2">
      <div className="text-sm text-gray-600">
        Mostrando {startEntry}-{endEntry} de {totalCount} entradas
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <div className="text-sm">
          Página {currentPage} de {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
