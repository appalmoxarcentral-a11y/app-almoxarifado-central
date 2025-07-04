
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Filter } from 'lucide-react';
import type { PurchaseFilters } from '@/types/purchase';

interface PurchaseFiltersProps {
  filters: PurchaseFilters;
  onFiltersChange: (filters: PurchaseFilters) => void;
}

export function PurchaseFilters({ filters, onFiltersChange }: PurchaseFiltersProps) {
  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, searchTerm: value });
  };

  const handleEstoqueMinimoChange = (value: string) => {
    const estoqueMinimo = value === '' ? undefined : parseInt(value);
    onFiltersChange({ ...filters, estoqueMinimo });
  };

  const handleComReposicaoChange = (checked: boolean) => {
    onFiltersChange({ ...filters, comReposicao: checked });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Buscar Produto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Nome ou código..."
                value={filters.searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estoqueMinimo">Estoque Baixo (máximo)</Label>
            <Input
              id="estoqueMinimo"
              type="number"
              min="0"
              placeholder="ex: 10"
              value={filters.estoqueMinimo || ''}
              onChange={(e) => handleEstoqueMinimoChange(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="comReposicao"
              checked={filters.comReposicao}
              onCheckedChange={handleComReposicaoChange}
            />
            <Label htmlFor="comReposicao" className="text-sm">
              Apenas com reposição
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
