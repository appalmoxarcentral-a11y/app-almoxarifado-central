
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Eye, EyeOff, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UnidadeMedida {
  id: string;
  codigo: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
}

export function UnidadeMedidaManager() {
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnidade, setEditingUnidade] = useState<UnidadeMedida | null>(null);
  const [formData, setFormData] = useState({ codigo: '', descricao: '' });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [unidadeToDelete, setUnidadeToDelete] = useState<UnidadeMedida | null>(null);
  const { toast } = useToast();
  const { user, hasPermission } = useAuth();

  useEffect(() => {
    loadUnidades();
  }, []);

  const loadUnidades = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('unidades_medida')
        .select('*')
        .order('codigo');

      if (error) throw error;
      setUnidades(data || []);
    } catch (error) {
      toast({
        title: "Erro ao carregar unidades",
        description: "Não foi possível carregar as unidades de medida.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasPermission('cadastro_produtos')) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para gerenciar unidades de medida.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.codigo || !formData.descricao) {
      toast({
        title: "Campos obrigatórios",
        description: "Código e descrição são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Verificar se já existe uma unidade com este código
    const codigoUpper = formData.codigo.toUpperCase();
    const existingUnidade = unidades.find(u => u.codigo === codigoUpper && u.id !== editingUnidade?.id);
    if (existingUnidade) {
      toast({
        title: "Código já existe",
        description: `Já existe uma unidade de medida com o código "${codigoUpper}".`,
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingUnidade) {
        // Atualizar unidade existente
        const { error } = await supabase
          .from('unidades_medida')
          .update({
            codigo: formData.codigo.toUpperCase(),
            descricao: formData.descricao,
          })
          .eq('id', editingUnidade.id);

        if (error) {
          if (error.code === '23505') {
            toast({
              title: "Código já existe",
              description: "Já existe uma unidade de medida com este código.",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Unidade atualizada com sucesso!",
          description: `${formData.codigo} - ${formData.descricao}`,
        });
      } else {
        // Criar nova unidade
        const { error } = await supabase
          .from('unidades_medida')
          .insert({
            codigo: formData.codigo.toUpperCase(),
            descricao: formData.descricao,
            created_by: user?.id
          });

        if (error) {
          if (error.code === '23505') {
            toast({
              title: "Código já existe",
              description: "Já existe uma unidade de medida com este código.",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Unidade criada com sucesso!",
          description: `${formData.codigo} - ${formData.descricao}`,
        });
      }

      setFormData({ codigo: '', descricao: '' });
      setEditingUnidade(null);
      setDialogOpen(false);
      await loadUnidades();
    } catch (error) {
      toast({
        title: editingUnidade ? "Erro ao atualizar unidade" : "Erro ao criar unidade",
        description: `Não foi possível ${editingUnidade ? 'atualizar' : 'criar'} a unidade de medida.`,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (unidade: UnidadeMedida) => {
    if (!hasPermission('cadastro_produtos')) return;
    setEditingUnidade(unidade);
    setFormData({
      codigo: unidade.codigo,
      descricao: unidade.descricao
    });
    setDialogOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingUnidade(null);
    setFormData({ codigo: '', descricao: '' });
    setDialogOpen(false);
  };

  const checkProductDependencies = async (unidadeId: string) => {
    try {
      const unidade = unidades.find(u => u.id === unidadeId);
      if (!unidade) {
        console.error('Unidade não encontrada:', unidadeId);
        return 0;
      }

      const { data, error } = await supabase
        .from('produtos')
        .select('id')
        .eq('unidade_medida', unidade.codigo as any);
      
      if (error) {
        console.error('Erro na consulta de produtos:', error);
        throw new Error(`Erro ao verificar dependências: ${error.message}`);
      }
      
      return data?.length || 0;
    } catch (error) {
      console.error('Erro ao verificar dependências de produtos:', error);
      throw error;
    }
  };

  const handleDeleteConfirm = async (unidade: UnidadeMedida) => {
    if (!hasPermission('pode_excluir')) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para excluir registros.",
        variant: "destructive",
      });
      return;
    }

    try {
      const dependencyCount = await checkProductDependencies(unidade.id);
      
      if (dependencyCount > 0) {
        toast({
          title: "Não é possível excluir",
          description: `Esta unidade está sendo usada por ${dependencyCount} produto(s). Desative-a em vez de excluir.`,
          variant: "destructive",
        });
        return;
      }

      setUnidadeToDelete(unidade);
      setDeleteConfirmOpen(true);
    } catch (error) {
      toast({
        title: "Erro ao verificar dependências",
        description: "Não foi possível verificar se a unidade está em uso.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!unidadeToDelete || !hasPermission('pode_excluir')) return;

    try {
      const { error } = await supabase
        .from('unidades_medida')
        .delete()
        .eq('id', unidadeToDelete.id);

      if (error) throw error;

      toast({
        title: "Unidade excluída com sucesso!",
        description: `${unidadeToDelete.codigo} - ${unidadeToDelete.descricao}`,
      });

      setDeleteConfirmOpen(false);
      setUnidadeToDelete(null);
      await loadUnidades();
    } catch (error) {
      toast({
        title: "Erro ao excluir unidade",
        description: "Não foi possível excluir a unidade de medida.",
        variant: "destructive",
      });
    }
  };

  const toggleUnidadeAtiva = async (id: string, ativo: boolean) => {
    if (!hasPermission('cadastro_produtos')) return;
    try {
      const { error } = await supabase
        .from('unidades_medida')
        .update({ ativo: !ativo })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Unidade ${!ativo ? 'ativada' : 'desativada'} com sucesso.`,
      });

      await loadUnidades();
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível atualizar o status da unidade.",
        variant: "destructive",
      });
    }
  };

  if (!hasPermission('cadastro_produtos')) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Você não tem permissão para gerenciar unidades de medida.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card shadow-xl rounded-2xl md:rounded-3xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-primary/5 blur-3xl -mr-16 -mt-16 md:-mr-32 md:-mt-32" />
      
      <CardHeader className="p-5 md:p-8 relative">
        <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xl md:text-3xl font-black tracking-tighter">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            Gerenciar Unidades
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto h-11 md:h-12 px-6 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                <Plus className="h-5 w-5" />
                Nova Unidade
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl md:rounded-3xl border-border bg-card max-w-[95vw] sm:max-w-md p-6">
              <DialogHeader>
                <DialogTitle className="text-xl md:text-2xl font-black tracking-tight">
                  {editingUnidade ? 'Editar Unidade' : 'Nova Unidade'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Código *</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => {
                      const newValue = e.target.value.toUpperCase();
                      setFormData(prev => ({ ...prev, codigo: newValue }));
                    }}
                    placeholder="Ex: ML, CP, FR..."
                    maxLength={10}
                    className="h-12 text-[16px]"
                  />
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Código curto para identificação (ex: ML, CP, FR).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descricao" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição *</Label>
                  <Input
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Ex: Mililitro (ML)"
                    className="h-12 text-[16px]"
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleCancelEdit} className="h-12 rounded-xl font-bold border-border">
                    Cancelar
                  </Button>
                  <Button type="submit" className="h-12 rounded-xl font-black uppercase tracking-widest">
                    {editingUnidade ? 'Atualizar' : 'Salvar Unidade'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 md:p-8 md:pt-0 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground mt-4 font-bold text-sm">Carregando...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {unidades.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground font-medium italic">Nenhuma unidade encontrada.</p>
              </div>
            ) : (
              unidades.map((unidade) => (
                <div 
                  key={unidade.id} 
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-5 border-2 rounded-2xl transition-all gap-4 ${
                    !unidade.ativo ? 'bg-muted/30 opacity-60 border-border/50' : 'bg-card border-border/50 hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Badge variant={unidade.ativo ? "default" : "secondary"} className="h-8 px-3 rounded-lg font-black tracking-widest text-[10px]">
                      {unidade.codigo}
                    </Badge>
                    <span className={`text-sm md:text-base font-bold ${unidade.ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {unidade.descricao}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(unidade)}
                      className="flex-1 sm:flex-none h-10 px-4 rounded-xl font-bold gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleUnidadeAtiva(unidade.id, unidade.ativo)}
                      className="flex-1 sm:flex-none h-10 px-4 rounded-xl font-bold gap-2 border-border"
                    >
                      {unidade.ativo ? (
                        <>
                          <EyeOff className="h-4 w-4" />
                          <span className="hidden xs:inline">Desativar</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          <span className="hidden xs:inline">Ativar</span>
                        </>
                      )}
                    </Button>

                    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteConfirm(unidade)}
                          className="h-10 w-10 sm:w-auto px-0 sm:px-4 rounded-xl font-bold text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Excluir</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl md:rounded-3xl border-border bg-card p-6">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                            Confirmar Exclusão
                          </AlertDialogTitle>
                          <AlertDialogDescription className="font-medium text-sm pt-2">
                            Tem certeza que deseja excluir a unidade <strong className="text-foreground">"{unidadeToDelete?.codigo} - {unidadeToDelete?.descricao}"</strong>?
                            <br /><br />
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-3 pt-4">
                          <AlertDialogCancel onClick={() => setUnidadeToDelete(null)} className="h-12 rounded-xl font-bold">
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="h-12 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black uppercase tracking-widest">
                            Excluir Registro
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
