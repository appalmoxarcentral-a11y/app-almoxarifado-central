
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';

interface ProductEntrySearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function ProductEntrySearch({ searchTerm, onSearchChange }: ProductEntrySearchProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="search">Buscar por produto ou lote</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          id="search"
          type="text"
          placeholder="Digite o nome do produto ou lote..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
    </div>
  );
}
