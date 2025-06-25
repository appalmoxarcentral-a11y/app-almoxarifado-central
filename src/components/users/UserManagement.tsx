
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
import { Users, UserPlus, Edit, UserX, UserCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { User, UserPermissions } from '@/types';

export function UserManagement() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState<'ADMIN' | 'COMUM'>('COMUM');
  const [permissoes, setPermissoes] = useState<UserPermissions>({
    cadastro_pacientes: false,
    cadastro_produtos: false,
    entrada_produtos: false,
    dispensacao: false,
    historicos: false,
    gestao_usuarios: false,
  });

  // Buscar usuários
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['usuarios', filtroTipo, filtroStatus],
    queryFn: async () => {
      let query = supabase
        .from('usuarios')
        .select('*')
        .order('nome');

      if (filtroTipo !== 'todos') {
        query = query.eq('tipo', filtroTipo as 'ADMIN' | 'COMUM');
      }
      if (filtroStatus !== 'todos') {
        query = query.eq('ativo', filtroStatus === 'ativo');
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Converter tipos Supabase para tipos TypeScript
      return data?.map(usuario => ({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo as 'ADMIN' | 'COMUM',
        permissoes: usuario.permissoes as UserPermissions,
        ativo: usuario.ativo,
        created_at: usuario.created_at
      })) as User[] || [];
    }
  });

  // Criar/Editar usuário
  const saveUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      if (editingUser) {
        // Editar usuário existente
        const updateData: any = {
          nome: userData.nome,
          email: userData.email,
          tipo: userData.tipo,
          permissoes: userData.permissoes
        };

        // Só incluir senha se foi preenchida
        if (userData.senha) {
          const { data: hashedPassword, error: hashError } = await supabase
            .rpc('hash_senha', { senha_texto: userData.senha });
          
          if (hashError) throw hashError;
          updateData.senha = hashedPassword;
        }

        const { error } = await supabase
          .from('usuarios')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) throw error;
      } else {
        // Criar novo usuário
        const { data: hashedPassword, error: hashError } = await supabase
          .rpc('hash_senha', { senha_texto: userData.senha });

        if (hashError) throw hashError;

        const { error } = await supabase
          .from('usuarios')
          .insert([{
            nome: userData.nome,
            email: userData.email,
            senha: hashedPassword,
            tipo: userData.tipo,
            permissoes: userData.permissoes
          }]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: editingUser ? "Usuário atualizado!" : "Usuário criado!",
        description: editingUser ? "As alterações foram salvas." : "O novo usuário foi criado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar usuário",
        description: error.message || "Não foi possível salvar o usuário.",
        variant: "destructive",
      });
    }
  });

  // Ativar/Desativar usuário
  const toggleUserMutation = useMutation({
    mutationFn: async ({ userId, ativo }: { userId: string, ativo: boolean }) => {
      const { error } = await supabase
        .from('usuarios')
        .update({ ativo })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: (_, { ativo }) => {
      toast({
        title: ativo ? "Usuário ativado!" : "Usuário desativado!",
        description: ativo ? "O usuário foi ativado com sucesso." : "O usuário foi desativado.",
      });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível alterar o status do usuário.",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setNome('');
    setEmail('');
    setSenha('');
    setTipo('COMUM');
    setPermissoes({
      cadastro_pacientes: false,
      cadastro_produtos: false,
      entrada_produtos: false,
      dispensacao: false,
      historicos: false,
      gestao_usuarios: false,
    });
    setEditingUser(null);
  };

  const openEditDialog = (usuario: User) => {
    setEditingUser(usuario);
    setNome(usuario.nome);
    setEmail(usuario.email);
    setSenha(''); // Senha fica vazia na edição
    setTipo(usuario.tipo);
    setPermissoes(usuario.permissoes);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome || !email || (!editingUser && !senha)) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    saveUserMutation.mutate({
      nome,
      email,
      senha,
      tipo,
      permissoes
    });
  };

  const handlePermissionChange = (permission: keyof UserPermissions, checked: boolean) => {
    setPermissoes(prev => ({
      ...prev,
      [permission]: checked
    }));
  };

  const usuariosAtivos = usuarios?.filter(u => u.ativo).length || 0;
  const usuariosInativos = usuarios?.filter(u => !u.ativo).length || 0;
  const usuariosAdmin = usuarios?.filter(u => u.tipo === 'ADMIN').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Gestão de Usuários</h1>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total de Usuários</p>
                <p className="text-2xl font-bold text-blue-600">{usuarios?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Usuários Ativos</p>
                <p className="text-2xl font-bold text-green-600">{usuariosAtivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Usuários Inativos</p>
                <p className="text-2xl font-bold text-red-600">{usuariosInativos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Administradores</p>
                <p className="text-2xl font-bold text-purple-600">{usuariosAdmin}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Ações */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Filtros</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="senha">
                        Senha {editingUser ? '(deixe vazio para manter)' : '*'}
                      </Label>
                      <Input
                        id="senha"
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder={editingUser ? "Nova senha" : "Senha"}
                      />
                    </div>
                    <div>
                      <Label htmlFor="tipo">Tipo de Usuário</Label>
                      <Select value={tipo} onValueChange={(value: 'ADMIN' | 'COMUM') => setTipo(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COMUM">Comum</SelectItem>
                          <SelectItem value="ADMIN">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Permissões</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      {Object.entries(permissoes).map(([key, value]) => (
                        <div key={key} className="flex items-center space-x-2">
                          <Checkbox
                            id={key}
                            checked={value}
                            onCheckedChange={(checked) => 
                              handlePermissionChange(key as keyof UserPermissions, checked as boolean)
                            }
                            disabled={tipo === 'ADMIN'}
                          />
                          <Label htmlFor={key} className="text-sm">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {tipo === 'ADMIN' && (
                      <p className="text-xs text-gray-500 mt-2">
                        Administradores têm todas as permissões automaticamente
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saveUserMutation.isPending}>
                      {saveUserMutation.isPending 
                        ? 'Salvando...' 
                        : editingUser ? 'Atualizar' : 'Criar'
                      }
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="filtroTipo">Tipo de Usuário</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="ADMIN">Administradores</SelectItem>
                  <SelectItem value="COMUM">Usuários Comuns</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filtroStatus">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="ativo">Apenas Ativos</SelectItem>
                  <SelectItem value="inativo">Apenas Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Carregando usuários...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios?.map((usuario) => (
                  <TableRow key={usuario.id}>
                    <TableCell className="font-medium">{usuario.nome}</TableCell>
                    <TableCell>{usuario.email}</TableCell>
                    <TableCell>
                      <Badge variant={usuario.tipo === 'ADMIN' ? 'default' : 'secondary'}>
                        {usuario.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={usuario.ativo ? 'default' : 'destructive'}>
                        {usuario.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(usuario)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant={usuario.ativo ? "destructive" : "default"}
                          onClick={() => toggleUserMutation.mutate({
                            userId: usuario.id,
                            ativo: !usuario.ativo
                          })}
                          disabled={usuario.id === currentUser?.id}
                        >
                          {usuario.ativo ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!usuarios || usuarios.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
