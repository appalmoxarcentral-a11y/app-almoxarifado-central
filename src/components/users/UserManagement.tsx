import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, UserPlus, Edit, Trash2, UserX, UserCheck, ShieldAlert, Zap, Building2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { User, UserPermissions } from '@/types';
import { MultiSelect, Option } from '@/components/ui/multi-select';

export function UserManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Opções de módulos para o MultiSelect
  const moduloOptions: Option[] = [
    { label: 'Cadastro de Pacientes', value: 'cadastro_pacientes' },
    { label: 'Cadastro de Produtos', value: 'cadastro_produtos' },
    { label: 'Entrada de Produtos', value: 'entrada_produtos' },
    { label: 'Dispensação', value: 'dispensacao' },
    { label: 'Históricos', value: 'historicos' },
    { label: 'Relatório de Compras', value: 'relatorio_compras' },
    { label: 'Gestão de Usuários', value: 'gestao_usuarios' },
  ];

  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [unidadeId, setUnidadeId] = useState<string>('');
  const [tipo, setTipo] = useState<'SUPER_ADMIN' | 'ADMIN' | 'COMUM'>('COMUM');
  const [permissoes, setPermissoes] = useState<UserPermissions>({
    cadastro_pacientes: false,
    cadastro_produtos: false,
    entrada_produtos: false,
    dispensacao: false,
    historicos: false,
    relatorio_compras: false,
    gestao_usuarios: false,
    gerenciar_rascunhos_compras: false,
    pode_excluir: false,
    acesso_global_pedidos: false,
  });

  // Buscar unidades para o select
  const { data: unidades } = useQuery({
    queryKey: ['unidades_saude'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades_saude')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    }
  });

  // Buscar perfis (nova tabela profiles)
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          unidade:unidades_saude(nome)
        `)
        .order('full_name');

      if (error) throw error;
      
      // Mapear Profiles para User type
      const mapped = data?.map(p => ({
        id: p.id,
        nome: p.full_name || '',
        email: p.email || '',
        tipo: p.role === 'super_admin' ? 'SUPER_ADMIN' : p.role === 'admin' ? 'ADMIN' : 'COMUM',
        permissoes: (p.permissions as unknown as UserPermissions) || {},
        ativo: true,
        created_at: p.created_at,
        tenant_id: p.tenant_id || '00000000-0000-0000-0000-000000000000',
        unidade_id: p.unidade_id,
        unidade_nome: (p.unidade as any)?.nome
      })) as any[] || [];

      // Se o usuário atual for SUPER_ADMIN, ele vê todos.
      if (currentUser?.tipo === 'SUPER_ADMIN') {
        return mapped;
      }
      
      // Para ADMIN comum, mostrar apenas os membros da mesma organização (tenant)
      const filtered = mapped.filter(u => 
        u.tipo !== 'SUPER_ADMIN' && 
        u.tenant_id === currentUser?.tenant_id
      );
      
      return filtered;
    }
  });

  // Criar/Editar usuário (SIMULADO PARA MVP SEM EDGE FUNCTION)
  const saveUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      if (editingUser) {
        // Atualizar perfil existente
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: userData.nome,
            role: userData.tipo === 'SUPER_ADMIN' ? 'super_admin' : userData.tipo === 'ADMIN' ? 'admin' : 'user',
            permissions: userData.permissoes,
            unidade_id: userData.unidade_id || null
          })
          .eq('id', editingUser.id);

        if (error) throw error;
      } else {
        throw new Error("Para cadastrar novos usuários, peça para eles criarem uma conta no link /signup com este email, ou configure o envio de convites no painel do Supabase.");
      }
    },
    onSuccess: () => {
      toast({
        title: "Usuário atualizado!",
        description: "Perfil e vínculo atualizados com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Excluir usuário via RPC
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('delete_user', { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Usuário excluído!",
        description: "O acesso e o perfil foram removidos com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setIsDeleteAlertOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setNome('');
    setEmail('');
    setUnidadeId('');
    setTipo('COMUM');
    setPermissoes({
      cadastro_pacientes: false,
      cadastro_produtos: false,
      entrada_produtos: false,
      dispensacao: false,
      historicos: false,
      relatorio_compras: false,
      gestao_usuarios: false,
      gerenciar_rascunhos_compras: false,
      pode_excluir: false,
      acesso_global_pedidos: false,
    });
    setEditingUser(null);
  };

  const openEditDialog = (usuario: any) => {
    setEditingUser(usuario);
    setNome(usuario.nome);
    setEmail(usuario.email);
    setUnidadeId(usuario.unidade_id || '');
    setTipo(usuario.tipo);
    setPermissoes(usuario.permissoes);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveUserMutation.mutate({
      nome,
      email,
      tipo,
      permissoes,
      unidade_id: unidadeId
    });
  };

  const handlePermissionChange = (permission: keyof UserPermissions, checked: boolean) => {
    setPermissoes(prev => ({
      ...prev,
      [permission]: checked
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Equipe da Farmácia</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
            <Button onClick={resetForm}>
                <UserPlus className="h-4 w-4 mr-2" />
                Convidar Membro
            </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>
                {editingUser ? 'Editar Membro' : 'Convidar Novo Membro'}
                </DialogTitle>
            </DialogHeader>
            
            {!editingUser && (
                <div className="bg-blue-50 p-4 rounded-md text-sm text-blue-800 mb-4">
                    <p><strong>Como funciona:</strong> Ao adicionar um membro, ele deverá criar uma conta na página de login usando o mesmo email informado aqui. O sistema irá vinculá-lo automaticamente à sua empresa.</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome do funcionário"
                    required
                    />
                </div>
                <div>
                    <Label htmlFor="email">Email Corporativo</Label>
                    <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="funcionario@farmacia.com"
                    required
                    disabled={!!editingUser} // Não pode mudar email de usuário existente
                    />
                </div>
                </div>

                <div>
                    <Label htmlFor="tipo">Função</Label>
                    <Select value={tipo} onValueChange={(value: 'SUPER_ADMIN' | 'ADMIN' | 'COMUM') => setTipo(value)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="COMUM">Farmacêutico / Atendente</SelectItem>
                        <SelectItem value="ADMIN">Administrador da Unidade</SelectItem>
                        {currentUser?.tipo === 'SUPER_ADMIN' && (
                            <SelectItem value="SUPER_ADMIN">Super Administrador (SaaS)</SelectItem>
                        )}
                    </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label htmlFor="unidade">Unidade de Saúde</Label>
                    <Select value={unidadeId} onValueChange={setUnidadeId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecione uma unidade..." />
                    </SelectTrigger>
                    <SelectContent>
                        {unidades?.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>

                <div>
                  <Label>Módulos com Acesso</Label>
                  <MultiSelect
                    options={moduloOptions}
                    selected={Object.entries(permissoes)
                      .filter(([key, value]) => value && 
                        key !== 'pode_excluir' && 
                        key !== 'gerenciar_rascunhos_compras' && 
                        key !== 'acesso_global_pedidos'
                      )
                      .map(([key]) => key)}
                    onChange={(selected) => {
                      const newPerms = { ...permissoes };
                      // Reset all modules first
                      moduloOptions.forEach(opt => {
                        newPerms[opt.value as keyof UserPermissions] = false;
                      });
                      // Set selected
                      selected.forEach(val => {
                        newPerms[val as keyof UserPermissions] = true;
                      });
                      setPermissoes(newPerms);
                    }}
                    placeholder="Selecione os módulos..."
                    disabled={tipo === 'ADMIN'}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2 border p-3 rounded-md bg-accent/50">
                    <Checkbox
                      id="pode_excluir"
                      checked={permissoes.pode_excluir}
                      onCheckedChange={(checked) => 
                        handlePermissionChange('pode_excluir', checked as boolean)
                      }
                      disabled={tipo === 'ADMIN'}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="pode_excluir" className="flex items-center gap-2 cursor-pointer">
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                        Permitir Exclusão de Registros
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Apagar registros (pacientes, produtos, etc).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 border p-3 rounded-md bg-accent/50">
                    <Checkbox
                      id="acesso_global_pedidos"
                      checked={permissoes.acesso_global_pedidos}
                      onCheckedChange={(checked) => 
                        handlePermissionChange('acesso_global_pedidos', checked as boolean)
                      }
                      disabled={tipo === 'ADMIN'}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="acesso_global_pedidos" className="flex items-center gap-2 cursor-pointer text-primary">
                        <Zap className="h-4 w-4" />
                        Permitir acesso global pedidos
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Visualizar e editar pedidos de todas as unidades.
                      </p>
                    </div>
                  </div>
                </div>

                {tipo === 'ADMIN' && (
                    <p className="text-xs text-blue-600 mt-2 font-medium">
                    Administradores possuem acesso total (CRUD) em todos os módulos por padrão.
                    </p>
                )}

                <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={saveUserMutation.isPending}>
                    {saveUserMutation.isPending 
                    ? 'Salvando...' 
                    : editingUser ? 'Atualizar Permissões' : 'Gerar Convite'
                    }
                </Button>
                </div>
            </form>
            </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membros Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Carregando equipe...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios?.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell className="font-medium">{usuario.nome}</TableCell>
                    <TableCell>{usuario.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <Building2 className="h-3 w-3" />
                        {usuario.unidade_nome || 'Sem unidade'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={usuario.tipo === 'SUPER_ADMIN' ? 'destructive' : usuario.tipo === 'ADMIN' ? 'default' : 'outline'}
                      >
                        {usuario.tipo === 'SUPER_ADMIN' ? 'Super Admin' : usuario.tipo === 'ADMIN' ? 'Admin' : 'Membro'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(usuario.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(usuario)}
                        title="Editar Permissões"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      {/* Botão de Excluir: apenas para Admins/SuperAdmins e não pode excluir a si mesmo */}
                      {(currentUser?.tipo === 'SUPER_ADMIN' || currentUser?.tipo === 'ADMIN') && usuario.id !== currentUser?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setUserToDelete(usuario);
                            setIsDeleteAlertOpen(true);
                          }}
                          title="Excluir Usuário"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(!usuarios || usuarios.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum membro encontrado. Adicione sua equipe!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente o usuário <strong>{userToDelete?.nome}</strong> ({userToDelete?.email}) e removerá todo o seu acesso ao sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Excluindo...' : 'Sim, excluir usuário'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
