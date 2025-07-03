
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface HistoryFiltersProps {
  filtroDataInicial: string;
  setFiltroDataInicial: (value: string) => void;
  filtroDataFinal: string;
  setFiltroDataFinal: (value: string) => void;
  filtroProduto: string;
  setFiltroProduto: (value: string) => void;
  filtroPaciente: string;
  setFiltroPaciente: (value: string) => void;
  filtroTipo: string;
  setFiltroTipo: (value: string) => void;
  buscaDinamica: string;
  setBuscaDinamica: (value: string) => void;
  hasActiveFilters: boolean;
  limparFiltros: () => void;
  getSearchPlaceholder: () => string;
  produtos?: Array<{ id: string; descricao: string; codigo: string }>;
  pacientes?: Array<{ id: string; nome: string; sus_cpf: string }>;
}

export function HistoryFilters({
  filtroDataInicial,
  setFiltroDataInicial,
  filtroDataFinal,
  setFiltroDataFinal,
  filtroProduto,
  setFiltroProduto,
  filtroPaciente,
  setFiltroPaciente,
  filtroTipo,
  setFiltroTipo,
  buscaDinamica,
  setBuscaDinamica,
  hasActiveFilters,
  limparFiltros,
  getSearchPlaceholder,
  produtos,
  pacientes
}: HistoryFiltersProps) {
  // Componente de filtros para mobile
  const MobileFilters = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="filtroDataInicial">Data Inicial</Label>
          <Input
            id="filtroDataInicial"
            type="date"
            value={filtroDataInicial}
            onChange={(e) => setFiltroDataInicial(e.target.value)}
            className="h-12"
          />
        </div>
        <div>
          <Label htmlFor="filtroDataFinal">Data Final</Label>
          <Input
            id="filtroDataFinal"
            type="date"
            value={filtroDataFinal}
            onChange={(e) => setFiltroDataFinal(e.target.value)}
            className="h-12"
          />
        </div>
        <div>
          <Label htmlFor="filtroProduto">Produto</Label>
          <Select value={filtroProduto} onValueChange={setFiltroProduto}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Todos os produtos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {produtos?.map((produto) => (
                <SelectItem key={produto.id} value={produto.id}>
                  {produto.descricao} ({produto.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="filtroPaciente">Paciente (Lista)</Label>
          <Select value={filtroPaciente} onValueChange={setFiltroPaciente}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Todos os pacientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os pacientes</SelectItem>
              {pacientes?.map((paciente) => (
                <SelectItem key={paciente.id} value={paciente.id}>
                  {paciente.nome} ({paciente.sus_cpf})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="filtroTipo">Tipo de Movimentação</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="entradas">Apenas Entradas</SelectItem>
              <SelectItem value="dispensacoes-pacientes">Dispensações Pacientes</SelectItem>
              <SelectItem value="dispensacoes-produtos">Dispensações Produtos</SelectItem>
              <SelectItem value="apenas-estoque">Apenas em estoque</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Busca dinâmica - apenas se não for "todos" */}
        {filtroTipo !== 'todos' && filtroTipo !== 'apenas-estoque' && (
          <div>
            <Label htmlFor="buscaDinamica">Buscar</Label>
            <Input
              id="buscaDinamica"
              value={buscaDinamica}
              onChange={(e) => setBuscaDinamica(e.target.value)}
              placeholder={getSearchPlaceholder()}
              className="h-12"
            />
          </div>
        )}
      </div>
      {hasActiveFilters && (
        <Button onClick={limparFiltros} variant="outline" className="w-full h-12">
          <X className="h-4 w-4 mr-2" />
          Limpar Filtros
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Filtros Mobile */}
      <div className="block md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full h-12 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-auto">
                  Ativos
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[90vh]">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>
                Configure os filtros para personalizar a visualização
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <MobileFilters />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Filtros Desktop */}
      <div className="hidden md:block">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Filtros
              {hasActiveFilters && (
                <Button onClick={limparFiltros} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="filtroDataInicial">Data Inicial</Label>
                <Input
                  id="filtroDataInicial"
                  type="date"
                  value={filtroDataInicial}
                  onChange={(e) => setFiltroDataInicial(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filtroDataFinal">Data Final</Label>
                <Input
                  id="filtroDataFinal"
                  type="date"
                  value={filtroDataFinal}
                  onChange={(e) => setFiltroDataFinal(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filtroProduto">Produto</Label>
                <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {produtos?.map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        {produto.descricao} ({produto.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filtroPaciente">Paciente (Lista)</Label>
                <Select value={filtroPaciente} onValueChange={setFiltroPaciente}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os pacientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os pacientes</SelectItem>
                    {pacientes?.map((paciente) => (
                      <SelectItem key={paciente.id} value={paciente.id}>
                        {paciente.nome} ({paciente.sus_cpf})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filtroTipo">Tipo de Movimentação</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="entradas">Apenas Entradas</SelectItem>
                    <SelectItem value="dispensacoes-pacientes">Dispensações Pacientes</SelectItem>
                    <SelectItem value="dispensacoes-produtos">Dispensações Produtos</SelectItem>
                    <SelectItem value="apenas-estoque">Apenas em estoque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Busca dinâmica - apenas se não for "todos" */}
              {filtroTipo !== 'todos' && filtroTipo !== 'apenas-estoque' && (
                <div>
                  <Label htmlFor="buscaDinamica">Buscar</Label>
                  <Input
                    id="buscaDinamica"
                    value={buscaDinamica}
                    onChange={(e) => setBuscaDinamica(e.target.value)}
                    placeholder={getSearchPlaceholder()}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
