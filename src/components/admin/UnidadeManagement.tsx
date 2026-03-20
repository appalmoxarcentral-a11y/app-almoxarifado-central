import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Plus, Search, Edit, Trash2, MapPin, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Unidade {
  id: string;
  nome: string;
  codigo: string;
  endereco: string;
  bairro: string;
  cidade: string;
  ativo: boolean;
  usar_tipo_dispensacao: boolean;
}

export function UnidadeManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnidade, setEditingUnidade] = useState<Unidade | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [usarTipoDispensacao, setUsarTipoDispensacao] = useState(false);

  const { data: unidades, isLoading } = useQuery({
    queryKey: ['unidades_saude'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades_saude')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Unidade[];
    }
  });

  const saveUnidadeMutation = useMutation({
    mutationFn: async (unidadeData: any) => {
      if (editingUnidade) {
        const { error } = await supabase
          .from('unidades_saude')
          .update(unidadeData)
          .eq('id', editingUnidade.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('unidades_saude')
          .insert([unidadeData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: editingUnidade ? "Unidade atualizada!" : "Unidade criada!",
        description: `A unidade foi ${editingUnidade ? 'atualizada' : 'criada'} com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['unidades_saude'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao salvar unidade",
        description: error.message,
      });
    }
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string, ativo: boolean }) => {
      const { error } = await supabase
        .from('unidades_saude')
        .update({ ativo: !ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unidades_saude'] });
      toast({ title: "Status alterado", description: "O status da unidade foi atualizado." });
    }
  });

  const resetForm = () => {
    setNome('');
    setCodigo('');
    setEndereco('');
    setBairro('');
    setCidade('');
    setAtivo(true);
    setUsarTipoDispensacao(false);
    setEditingUnidade(null);
  };

  const openEditDialog = (unidade: Unidade) => {
    setEditingUnidade(unidade);
    setNome(unidade.nome);
    setCodigo(unidade.codigo);
    setEndereco(unidade.endereco || '');
    setBairro(unidade.bairro || '');
    setCidade(unidade.cidade || '');
    setAtivo(unidade.ativo);
    setUsarTipoDispensacao(unidade.usar_tipo_dispensacao || false);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveUnidadeMutation.mutate({
      nome,
      codigo,
      endereco,
      bairro,
      cidade,
      ativo,
      usar_tipo_dispensacao: usarTipoDispensacao
    });
  };

  const filteredUnidades = unidades?.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.bairro && u.bairro.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-8 w-8 text-emerald-600" />
          <h1 className="text-3xl font-bold">Unidades de Saúde</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Nova Unidade
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingUnidade ? 'Editar Unidade' : 'Cadastrar Nova Unidade'}</DialogTitle>
              <DialogDescription>
                Preencha as informações básicas da unidade de saúde.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Unidade</Label>
                  <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código / CNES</Label>
                  <Input id="codigo" value={codigo} onChange={e => setCodigo(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço Completo</Label>
                <Input id="endereco" value={endereco} onChange={e => setEndereco(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" value={bairro} onChange={e => setBairro(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" value={cidade} onChange={e => setCidade(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg border border-border/50">
                <Checkbox 
                  id="usarTipoDispensacao" 
                  checked={usarTipoDispensacao} 
                  onCheckedChange={(checked) => setUsarTipoDispensacao(!!checked)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label 
                    htmlFor="usarTipoDispensacao"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Usar campo "Tipo Dispensação"
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Se ativado, esta unidade poderá selecionar o procedimento durante a dispensação.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saveUnidadeMutation.isPending}>
                  {saveUnidadeMutation.isPending ? 'Salvando...' : 'Salvar Unidade'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Listagem de Unidades</CardTitle>
              <CardDescription>Gerencie as unidades de saúde cadastradas no sistema.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input 
                placeholder="Buscar por nome ou código..." 
                className="pl-10"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando unidades...</TableCell></TableRow>
              ) : filteredUnidades?.map(unidade => (
                <TableRow key={unidade.id}>
                  <TableCell>
                    <div className="font-medium">{unidade.nome}</div>
                    <div className="text-xs text-zinc-500 font-mono">{unidade.codigo}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="h-3 w-3 text-zinc-400" />
                      {unidade.bairro ? `${unidade.bairro}, ` : ''}{unidade.cidade}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={unidade.ativo ? "default" : "secondary"}>
                      {unidade.ativo ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(unidade)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={unidade.ativo ? "text-amber-600" : "text-emerald-600"}
                        onClick={() => toggleAtivoMutation.mutate({ id: unidade.id, ativo: unidade.ativo })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUnidades?.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-zinc-500">Nenhuma unidade encontrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
