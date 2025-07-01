
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const [formData, setFormData] = useState({ codigo: '', descricao: '' });
  const { toast } = useToast();
  const { user } = useAuth();

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
    
    if (!formData.codigo || !formData.descricao) {
      toast({
        title: "Campos obrigatórios",
        description: "Código e descrição são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('unidades_medida')
        .insert({
          codigo: formData.codigo.toUpperCase(),
          descricao: formData.descricao,
          created_by: user?.id
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
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

      setFormData({ codigo: '', descricao: '' });
      setDialogOpen(false);
      await loadUnidades();
    } catch (error) {
      toast({
        title: "Erro ao criar unidade",
        description: "Não foi possível criar a unidade de medida.",
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
                <DialogTitle>Adicionar Nova Unidade de Medida</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código *</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                    placeholder="Ex: ML, CP, FR..."
                    maxLength={10}
                  />
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
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Salvar
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
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
