
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Plus, Trash2, Edit, Save, X, Briefcase, BookOpen, Ruler } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';

type TableType = 'setores' | 'procedimentos' | 'unidades_medida';

export default function ManagementPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editCode, setEditCode] = useState(''); // Para unidades_medida
  const [newValue, setNewValue] = useState('');
  const [newCode, setNewCode] = useState(''); // Para unidades_medida
  const [isSaving, setIsSaving] = useState(false);

  // Queries
  const { data: setores, isLoading: loadingSetores } = useQuery({
    queryKey: ['setores-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setores')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: procedimentos, isLoading: loadingProcedimentos } = useQuery({
    queryKey: ['procedimentos-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('procedimentos')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: unidadesMedida, isLoading: loadingUnidades } = useQuery({
    queryKey: ['unidades-medida-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades_medida')
        .select('*')
        .order('descricao');
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Liberado para todos os usuários autenticados conforme solicitação
  const canEdit = !!user; 

  const handleAdd = async (table: TableType) => {
    if (!newValue.trim() || !canEdit) return;
    if (table === 'unidades_medida' && !newCode.trim()) {
      toast({ title: "Erro", description: "Código é obrigatório para Unidade de Medida", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      let payload: any = {};
      
      if (table === 'unidades_medida') {
        payload = { 
          codigo: newCode.trim().toUpperCase(), 
          descricao: newValue.trim(),
          ativo: true
        };
      } else {
        payload = { nome: newValue.trim() };
        if (table === 'setores' && user?.tenant_id) {
          payload.tenant_id = user.tenant_id;
        }
      }
      
      const { error } = await supabase.from(table).insert([payload]);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Item adicionado com sucesso!" });
      setNewValue('');
      setNewCode('');
      queryClient.invalidateQueries({ queryKey: [table === 'setores' ? 'setores-admin' : table === 'procedimentos' ? 'procedimentos-admin' : 'unidades-medida-admin'] });
      queryClient.invalidateQueries({ queryKey: [table] });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (table: TableType, id: string) => {
    if (!editValue.trim() || !canEdit) return;
    setIsSaving(true);
    try {
      let payload: any = {};
      if (table === 'unidades_medida') {
        payload = { 
          codigo: editCode.trim().toUpperCase(), 
          descricao: editValue.trim() 
        };
      } else {
        payload = { nome: editValue.trim() };
      }

      const { error } = await supabase.from(table).update(payload).eq('id', id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Item atualizado com sucesso!" });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: [table === 'setores' ? 'setores-admin' : table === 'procedimentos' ? 'procedimentos-admin' : 'unidades-medida-admin'] });
      queryClient.invalidateQueries({ queryKey: [table] });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (table: TableType, id: string) => {
    if (!canEdit || !window.confirm('Tem certeza que deseja excluir este item?')) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;

      toast({ title: "Sucesso", description: "Item excluído com sucesso!" });
      queryClient.invalidateQueries({ queryKey: [table === 'setores' ? 'setores-admin' : table === 'procedimentos' ? 'procedimentos-admin' : 'unidades-medida-admin'] });
      queryClient.invalidateQueries({ queryKey: [table] });
    } catch (error: any) {
      toast({ title: "Erro", description: "Não foi possível excluir o item. Ele pode estar sendo usado.", variant: "destructive" });
    }
  };

  const renderList = (items: any[], table: TableType) => {
    const filtered = items?.filter(item => {
      const name = table === 'unidades_medida' ? item.descricao : item.nome;
      const code = table === 'unidades_medida' ? item.codigo : '';
      return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             code.toLowerCase().includes(searchTerm.toLowerCase());
    }) || [];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          {table === 'unidades_medida' && (
            <div className="md:col-span-3">
              <Input 
                placeholder="Código (Ex: UN)"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
          )}
          <div className={table === 'unidades_medida' ? "md:col-span-6" : "md:col-span-9"}>
            <Input 
              placeholder={table === 'unidades_medida' ? "Descrição (Ex: Unidade)" : `Novo ${table === 'setores' ? 'setor' : 'procedimento'}...`}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>
          <div className="md:col-span-3">
            <Button 
              onClick={() => handleAdd(table)} 
              disabled={!newValue.trim() || isSaving}
              className="h-12 w-full rounded-xl"
            >
              <Plus className="h-5 w-5 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 rounded-xl"
          />
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {table === 'unidades_medida' && <th className="p-4 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Código</th>}
                  <th className="p-4 font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Nome / Descrição</th>
                  <th className="p-4 font-bold uppercase text-[10px] tracking-widest text-muted-foreground text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    {table === 'unidades_medida' && (
                      <td className="p-4">
                        {editingId === item.id ? (
                          <Input 
                            value={editCode} 
                            onChange={(e) => setEditCode(e.target.value)}
                            className="h-9 rounded-lg"
                          />
                        ) : (
                          <span className="font-bold text-primary">{item.codigo}</span>
                        )}
                      </td>
                    )}
                    <td className="p-4">
                      {editingId === item.id ? (
                        <Input 
                          value={editValue} 
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-9 rounded-lg"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{table === 'unidades_medida' ? item.descricao : item.nome}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {editingId === item.id ? (
                          <>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => { setEditingId(null); setEditValue(''); setEditCode(''); }}
                              className="h-8 w-8 text-muted-foreground"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleUpdate(table, item.id)}
                              disabled={isSaving}
                              className="h-8 w-8 text-primary"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => { 
                                setEditingId(item.id); 
                                setEditValue(table === 'unidades_medida' ? item.descricao : item.nome);
                                if (table === 'unidades_medida') setEditCode(item.codigo);
                              }}
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleDelete(table, item.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={table === 'unidades_medida' ? 3 : 2} className="p-8 text-center text-muted-foreground italic">
                      Nenhum item encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6 md:space-y-10 pb-24 md:pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6 md:pb-8">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="p-2.5 md:p-3 bg-primary/10 rounded-xl md:rounded-2xl shrink-0">
              <BookOpen className="h-6 w-6 md:h-10 md:w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-5xl font-black tracking-tight text-foreground leading-tight">Configurações do Sistema</h1>
              <p className="text-muted-foreground text-sm md:text-xl mt-0.5 md:mt-2 font-medium">Gerencie setores, procedimentos e unidades</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="setores" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-2xl h-auto md:h-14 border border-border/50 flex flex-wrap gap-1">
            <TabsTrigger value="setores" className="rounded-xl px-4 md:px-8 py-2 md:py-0 font-bold text-xs md:text-sm uppercase tracking-widest flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Setores
            </TabsTrigger>
            <TabsTrigger value="procedimentos" className="rounded-xl px-4 md:px-8 py-2 md:py-0 font-bold text-xs md:text-sm uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Procedimentos
            </TabsTrigger>
            <TabsTrigger value="unidades" className="rounded-xl px-4 md:px-8 py-2 md:py-0 font-bold text-xs md:text-sm uppercase tracking-widest flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Unidades de Medida
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setores">
            <Card className="border-border bg-card shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="p-6 md:p-8 pb-4">
                <CardTitle className="text-xl md:text-2xl font-black tracking-tight">Gerenciar Setores</CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8 pt-0">
                {loadingSetores ? <div>Carregando...</div> : renderList(setores || [], 'setores')}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="procedimentos">
            <Card className="border-border bg-card shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="p-6 md:p-8 pb-4">
                <CardTitle className="text-xl md:text-2xl font-black tracking-tight">Gerenciar Procedimentos</CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8 pt-0">
                {loadingProcedimentos ? <div>Carregando...</div> : renderList(procedimentos || [], 'procedimentos')}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unidades">
            <Card className="border-border bg-card shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="p-6 md:p-8 pb-4">
                <CardTitle className="text-xl md:text-2xl font-black tracking-tight">Gerenciar Unidades de Medida</CardTitle>
              </CardHeader>
              <CardContent className="p-6 md:p-8 pt-0">
                {loadingUnidades ? <div>Carregando...</div> : renderList(unidadesMedida || [], 'unidades_medida')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
