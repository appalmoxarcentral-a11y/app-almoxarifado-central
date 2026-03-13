
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Filter } from 'lucide-react';
import type { PurchaseFilters } from '@/types/purchase';
import { useIsMobile } from '@/hooks/use-mobile';

interface PurchaseFiltersProps {
  filters: PurchaseFilters;
  onFiltersChange: (filters: PurchaseFilters) => void;
}

export function PurchaseFilters({ filters, onFiltersChange }: PurchaseFiltersProps) {
  const isMobile = useIsMobile();
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
    <Card className="border-muted-foreground/10 shadow-sm">
      <CardHeader className={`${isMobile ? 'py-3 px-4' : ''}`}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5 text-primary" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className={`${isMobile ? 'p-4 pt-0' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Buscar Produto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Nome ou código..."
                value={filters.searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 h-11 bg-muted/20 border-muted-foreground/10 focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estoqueMinimo" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estoque Baixo (máximo)</Label>
            <Input
              id="estoqueMinimo"
              type="number"
              min="0"
              placeholder="ex: 10"
              value={filters.estoqueMinimo || ''}
              onChange={(e) => handleEstoqueMinimoChange(e.target.value)}
              className="h-11 bg-muted/20 border-muted-foreground/10 focus:border-primary"
            />
          </div>

          <div className={`flex items-center space-x-2 ${isMobile ? 'pt-2' : 'pt-8'}`}>
            <Checkbox
              id="comReposicao"
              checked={filters.comReposicao}
              onCheckedChange={handleComReposicaoChange}
              className="h-5 w-5 border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <Label htmlFor="comReposicao" className="text-sm font-medium text-foreground">
              Apenas com reposição
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
