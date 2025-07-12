
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
  const [enumValues, setEnumValues] = useState<string[]>([]);
  const [showEnumWarning, setShowEnumWarning] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadUnidades();
    loadEnumValues();
  }, []);

  const loadEnumValues = async () => {
    // Por enquanto, usar valores conhecidos já que não temos função personalizada
    // Em produção, estes valores deveriam vir de uma consulta ao enum real
    setEnumValues(['AM', 'CP', 'BG', 'FR', 'CPS', 'ML', 'MG', 'G', 'KG', 'UN', 'PCT', 'CX', 'TST']);
  };

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
    
    if (!formData.codigo || !formData.descricao) {
      toast({
        title: "Campos obrigatórios",
        description: "Código e descrição são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Verificar se o código existe no enum para novos registros
    const codigoUpper = formData.codigo.toUpperCase();
    if (!editingUnidade && !enumValues.includes(codigoUpper)) {
      setShowEnumWarning(true);
      toast({
        title: "Atenção: Código não existe no sistema",
        description: `O código "${codigoUpper}" não está disponível no enum do banco. A unidade será criada, mas você precisará adicionar o valor ao enum via SQL para usar em produtos.`,
        variant: "destructive",
      });
      // Permitir continuar, mas mostrar aviso
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

        // Mostrar aviso se o código não está no enum
        if (!enumValues.includes(codigoUpper)) {
          setTimeout(() => {
            toast({
              title: "Sincronização necessária",
              description: `Para usar "${codigoUpper}" em produtos, adicione-o ao enum via SQL: ALTER TYPE unidade_medida ADD VALUE '${codigoUpper}';`,
              variant: "default",
            });
          }, 2000);
        }
      }

      setFormData({ codigo: '', descricao: '' });
      setEditingUnidade(null);
      setDialogOpen(false);
      setShowEnumWarning(false);
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
    setShowEnumWarning(false);
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
    if (!unidadeToDelete) return;

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

  if (user?.tipo !== 'ADMIN') {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Apenas administradores podem gerenciar unidades de medida.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Gerenciar Unidades de Medida
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nova Unidade
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUnidade ? 'Editar Unidade de Medida' : 'Adicionar Nova Unidade de Medida'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {showEnumWarning && !editingUnidade && formData.codigo && !enumValues.includes(formData.codigo.toUpperCase()) && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Atenção:</strong> O código "{formData.codigo.toUpperCase()}" não existe no enum do sistema. 
                      A unidade será criada, mas para usar em produtos você precisará executar:
                      <br />
                      <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                        ALTER TYPE unidade_medida ADD VALUE '{formData.codigo.toUpperCase()}';
                      </code>
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código *</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => {
                      const newValue = e.target.value.toUpperCase();
                      setFormData(prev => ({ ...prev, codigo: newValue }));
                      if (!editingUnidade && newValue && !enumValues.includes(newValue)) {
                        setShowEnumWarning(true);
                      } else {
                        setShowEnumWarning(false);
                      }
                    }}
                    placeholder="Ex: ML, CP, FR..."
                    maxLength={10}
                  />
                  {enumValues.length > 0 && (
                    <div className="text-sm text-gray-500">
                      Valores disponíveis no enum: {enumValues.join(', ')}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição *</Label>
                  <Input
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Ex: Mililitro (ML)"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingUnidade ? 'Atualizar' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-4">Carregando...</p>
        ) : (
          <div className="space-y-3">
            {unidades.length === 0 ? (
              <p className="text-center py-4 text-gray-500">Nenhuma unidade de medida encontrada.</p>
            ) : (
              unidades.map((unidade) => (
                <div 
                  key={unidade.id} 
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    !unidade.ativo ? 'bg-gray-50 opacity-75' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={unidade.ativo ? "default" : "secondary"}>
                      {unidade.codigo}
                    </Badge>
                    <span className={unidade.ativo ? '' : 'text-gray-500'}>
                      {unidade.descricao}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(unidade)}
                      className="flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleUnidadeAtiva(unidade.id, unidade.ativo)}
                      className="flex items-center gap-2"
                    >
                      {unidade.ativo ? (
                        <>
                          <EyeOff className="h-4 w-4" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          Ativar
                        </>
                      )}
                    </Button>

                    <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteConfirm(unidade)}
                          className="flex items-center gap-2 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir a unidade "{unidadeToDelete?.codigo} - {unidadeToDelete?.descricao}"?
                            <br /><br />
                            <strong>Esta ação não pode ser desfeita.</strong>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setUnidadeToDelete(null)}>
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
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
