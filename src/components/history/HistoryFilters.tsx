
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, X, Calendar as CalendarIcon, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SmartDatePicker } from '@/components/ui/smart-date-picker';

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
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5">
        <div className="space-y-2">
          <Label htmlFor="filtroDataInicial" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5" />
            Data Inicial
          </Label>
          <SmartDatePicker
            id="filtroDataInicial"
            value={filtroDataInicial}
            onChange={setFiltroDataInicial}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="filtroDataFinal" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5" />
            Data Final
          </Label>
          <SmartDatePicker
            id="filtroDataFinal"
            value={filtroDataFinal}
            onChange={setFiltroDataFinal}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="filtroProduto" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produto</Label>
          <Select value={filtroProduto} onValueChange={setFiltroProduto}>
            <SelectTrigger className="h-12 rounded-xl border-border bg-background text-[16px]">
              <SelectValue placeholder="Todos os produtos" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border">
              <SelectItem value="all">Todos os produtos</SelectItem>
              {produtos?.map((produto) => (
                <SelectItem key={produto.id} value={produto.id}>
                  {produto.descricao} ({produto.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="filtroPaciente" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Paciente (Lista)</Label>
          <Select value={filtroPaciente} onValueChange={setFiltroPaciente}>
            <SelectTrigger className="h-12 rounded-xl border-border bg-background text-[16px]">
              <SelectValue placeholder="Todos os pacientes" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border">
              <SelectItem value="all">Todos os pacientes</SelectItem>
              {pacientes?.map((paciente) => (
                <SelectItem key={paciente.id} value={paciente.id}>
                  {paciente.nome} ({paciente.sus_cpf})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="filtroTipo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de Movimentação</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="h-12 rounded-xl border-border bg-background text-[16px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border">
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
          <div className="space-y-2">
            <Label htmlFor="buscaDinamica" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="buscaDinamica"
                value={buscaDinamica}
                onChange={(e) => setBuscaDinamica(e.target.value)}
                placeholder={getSearchPlaceholder()}
                className="h-12 pl-11 text-[16px] rounded-xl border-border bg-background"
              />
            </div>
          </div>
        )}
      </div>
      {hasActiveFilters && (
        <Button onClick={limparFiltros} variant="destructive" className="w-full h-12 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-destructive/20">
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
            <Button variant="outline" className="w-full h-12 flex items-center gap-2 rounded-xl border-border bg-card shadow-sm font-bold">
              <Filter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-auto bg-primary/10 text-primary border-none font-black text-[10px] uppercase">
                  Ativos
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl border-border bg-card p-6">
            <SheetHeader className="text-left">
              <SheetTitle className="text-2xl font-black tracking-tighter">Filtros Avançados</SheetTitle>
              <SheetDescription className="font-medium text-muted-foreground">
                Refine sua busca no histórico
              </SheetDescription>
            </SheetHeader>
            <div className="mt-8">
              <MobileFilters />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Filtros Desktop */}
      <div className="hidden md:block">
        <Card className="border-border bg-card shadow-xl rounded-2xl md:rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl -mr-32 -mt-32" />
          
          <CardHeader className="p-6 md:p-8 relative">
            <CardTitle className="flex items-center justify-between text-xl md:text-2xl font-black tracking-tighter">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Filter className="h-5 w-5 text-primary" />
                </div>
                Filtros
              </div>
              {hasActiveFilters && (
                <Button onClick={limparFiltros} variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive font-bold">
                  <X className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 md:p-8 md:pt-0 relative">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label htmlFor="filtroDataInicial" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Data Inicial
                </Label>
                <SmartDatePicker
                  id="filtroDataInicial"
                  value={filtroDataInicial}
                  onChange={setFiltroDataInicial}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filtroDataFinal" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Data Final
                </Label>
                <SmartDatePicker
                  id="filtroDataFinal"
                  value={filtroDataFinal}
                  onChange={setFiltroDataFinal}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filtroProduto" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produto</Label>
                <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                  <SelectTrigger className="h-12 rounded-xl border-border bg-background">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {produtos?.map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        {produto.descricao} ({produto.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filtroPaciente" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Paciente (Lista)</Label>
                <Select value={filtroPaciente} onValueChange={setFiltroPaciente}>
                  <SelectTrigger className="h-12 rounded-xl border-border bg-background">
                    <SelectValue placeholder="Todos os pacientes" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    <SelectItem value="all">Todos os pacientes</SelectItem>
                    {pacientes?.map((paciente) => (
                      <SelectItem key={paciente.id} value={paciente.id}>
                        {paciente.nome} ({paciente.sus_cpf})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filtroTipo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de Movimentação</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="h-12 rounded-xl border-border bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
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
                <div className="space-y-2">
                  <Label htmlFor="buscaDinamica" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="buscaDinamica"
                      value={buscaDinamica}
                      onChange={(e) => setBuscaDinamica(e.target.value)}
                      placeholder={getSearchPlaceholder()}
                      className="h-12 pl-11 rounded-xl border-border bg-background"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
