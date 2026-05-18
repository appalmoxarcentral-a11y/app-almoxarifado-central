
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PurchaseFilters } from '@/types/purchase';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDebounce } from '@/hooks/useDebounce';
import { MultiSelect } from '@/components/ui/multi-select';
import type { Option } from '@/components/ui/multi-select';

interface PurchaseFiltersProps {
  filters: PurchaseFilters;
  onFiltersChange: (filters: PurchaseFilters) => void;
  unitMeasureOptions?: Option[];
  showOnlySearch?: boolean;
  showOnlyLowStock?: boolean;
}
export function PurchaseFilters({ filters, onFiltersChange, unitMeasureOptions = [], showOnlySearch, showOnlyLowStock }: PurchaseFiltersProps) {
  const isMobile = useIsMobile();
  
  // Estados locais para evitar lag na digitação
  const [localSearch, setLocalSearch] = useState(filters.searchTerm);
  const [localSearchType, setLocalSearchType] = useState(filters.searchType || 'todos');
  const [localEstoque, setLocalEstoque] = useState(filters.estoqueMinimo?.toString() || '');
  const [localUnitMeasures, setLocalUnitMeasures] = useState<string[]>([]);

  const debouncedSearch = useDebounce(localSearch, 300);
  const debouncedEstoque = useDebounce(localEstoque, 300);

  // Sincronizar quando os filtros mudarem externamente (ex: carregar rascunho)
  useEffect(() => {
    setLocalSearch(filters.searchTerm);
    setLocalSearchType(filters.searchType || 'todos');
    setLocalUnitMeasures(
      (filters.searchType === 'unidade' ? filters.searchTerm : '')
        .split(/[,\n;|]+/)
        .map(item => item.trim())
        .filter(Boolean)
    );
  }, [filters.searchTerm, filters.searchType]);

  useEffect(() => {
    setLocalEstoque(filters.estoqueMinimo?.toString() || '');
  }, [filters.estoqueMinimo]);

  // Aplicar filtros debounced
  useEffect(() => {
    if (localSearchType === 'unidade') return;

    if (debouncedSearch !== filters.searchTerm || localSearchType !== filters.searchType) {
      onFiltersChange({ ...filters, searchTerm: debouncedSearch, searchType: localSearchType as any });
    }
  }, [debouncedSearch, localSearchType]);

  useEffect(() => {
    if (localSearchType !== 'unidade') return;

    const joinedValues = localUnitMeasures.join(', ');
    if (joinedValues !== filters.searchTerm || localSearchType !== filters.searchType) {
      onFiltersChange({ ...filters, searchTerm: joinedValues, searchType: localSearchType as any });
    }
  }, [localUnitMeasures, localSearchType]);

  useEffect(() => {
    if (localSearchType !== 'unidade' && localUnitMeasures.length > 0) {
      setLocalUnitMeasures([]);
    }
  }, [localSearchType]);

  useEffect(() => {
    const val = debouncedEstoque === '' ? undefined : parseInt(debouncedEstoque);
    if (val !== filters.estoqueMinimo) {
      onFiltersChange({ ...filters, estoqueMinimo: val });
    }
  }, [debouncedEstoque]);

  if (showOnlySearch) {
    return (
      <div className="flex flex-col md:flex-row items-end gap-4 w-full">
        <div className="flex flex-col md:flex-row gap-2 w-full">
          <div className="w-full md:w-48 space-y-2">
            <Label htmlFor="searchType" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Buscar Por</Label>
            <Select value={localSearchType} onValueChange={setLocalSearchType}>
              <SelectTrigger id="searchType" className="h-10 bg-muted/20 border-muted-foreground/10 focus:border-primary font-medium">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os campos</SelectItem>
                <SelectItem value="codigo">Apenas Código</SelectItem>
                <SelectItem value="descricao">Apenas Descrição</SelectItem>
                <SelectItem value="unidade">Apenas Unid. Medida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1 w-full">
            <Label htmlFor="search" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Termo da Busca</Label>
            {localSearchType === 'unidade' ? (
              <MultiSelect
                options={unitMeasureOptions}
                selected={localUnitMeasures}
                onChange={setLocalUnitMeasures}
                placeholder="Selecione uma ou mais unidades..."
                className="min-h-10 bg-muted/20 border-muted-foreground/10 focus:border-primary font-medium"
              />
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={
                    localSearchType === 'codigo' ? 'Digite o código...' :
                    localSearchType === 'descricao' ? 'Digite a descrição...' :
                    'Nome, código ou unidade...'
                  }
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-10 h-10 bg-muted/20 border-muted-foreground/10 focus:border-primary font-medium"
                />
              </div>
            )}
            {localSearchType === 'unidade' && (
              <p className="text-[11px] text-muted-foreground">
                Marque uma ou mais unidades de medida para filtrar a lista.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showOnlyLowStock) {
    return (
      <div className="space-y-2">
        <Label htmlFor="estoqueMinimo" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estoque Baixo (máximo)</Label>
        <Input
          id="estoqueMinimo"
          type="number"
          min="0"
          placeholder="ex: 10"
          value={localEstoque}
          onChange={(e) => setLocalEstoque(e.target.value)}
          className="h-11 bg-muted/20 border-muted-foreground/10 focus:border-primary font-bold text-lg"
        />
      </div>
    );
  }

  return (
    <Card className="border-muted-foreground/10 shadow-sm">
      <CardHeader className={`${isMobile ? 'py-3 px-4' : ''}`}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5 text-primary" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className={`${isMobile ? 'p-4 pt-0' : ''}`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3 space-y-2">
            <Label htmlFor="searchType" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Buscar Por</Label>
            <Select value={localSearchType} onValueChange={setLocalSearchType}>
              <SelectTrigger id="searchType" className="h-11 bg-muted/20 border-muted-foreground/10 focus:border-primary">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os campos</SelectItem>
                <SelectItem value="codigo">Apenas Código</SelectItem>
                <SelectItem value="descricao">Apenas Descrição</SelectItem>
                <SelectItem value="unidade">Apenas Unid. Medida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-5 space-y-2">
            <Label htmlFor="search" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Termo da Busca</Label>
            {localSearchType === 'unidade' ? (
              <MultiSelect
                options={unitMeasureOptions}
                selected={localUnitMeasures}
                onChange={setLocalUnitMeasures}
                placeholder="Selecione uma ou mais unidades..."
                className="min-h-11 bg-muted/20 border-muted-foreground/10 focus:border-primary"
              />
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={
                    localSearchType === 'codigo' ? 'Digite o código...' :
                    localSearchType === 'descricao' ? 'Digite a descrição...' :
                    'Nome, código ou unidade...'
                  }
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="pl-10 h-11 bg-muted/20 border-muted-foreground/10 focus:border-primary"
                />
              </div>
            )}
            {localSearchType === 'unidade' && (
              <p className="text-[11px] text-muted-foreground">
                Marque uma ou mais unidades de medida para filtrar a lista.
              </p>
            )}
          </div>

          <div className="md:col-span-4 space-y-2">
            <Label htmlFor="estoqueMinimo" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estoque Baixo (máximo)</Label>
            <Input
              id="estoqueMinimo"
              type="number"
              min="0"
              placeholder="ex: 10"
              value={localEstoque}
              onChange={(e) => setLocalEstoque(e.target.value)}
              className="h-11 bg-muted/20 border-muted-foreground/10 focus:border-primary"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
