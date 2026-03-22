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
import { Users, UserPlus, Edit, Trash2, UserX, UserCheck, ShieldAlert, Zap, Building2, BookOpen, Mail, Calendar, ShieldCheck } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { User, UserPermissions } from '@/types';
import { MultiSelect, Option } from '@/components/ui/multi-select';

export function UserManagement() {
  const isMobile = useIsMobile();
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
    { label: 'Pedidos', value: 'relatorio_compras' },
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
      usar_tipo_dispensacao: false,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Equipe da Farmácia</h1>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
            <Button onClick={resetForm} className="w-full sm:w-auto h-12 sm:h-10 text-base sm:text-sm font-bold rounded-xl shadow-sm">
                <UserPlus className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                Convidar Membro
            </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl w-[95vw] rounded-3xl sm:rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-2xl font-black tracking-tight">
                {editingUser ? 'Editar Membro' : 'Convidar Novo Membro'}
                </DialogTitle>
            </DialogHeader>
            
            <ScrollArea className="max-h-[80vh] px-6 py-4">
              {!editingUser && (
                  <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl text-sm text-primary mb-6 flex gap-3">
                      <Zap className="h-5 w-5 shrink-0 mt-0.5" />
                      <p><strong>Como funciona:</strong> O membro deve criar uma conta usando o mesmo email para que o sistema vincule automaticamente à sua organização.</p>
                  </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-8 pb-6">
                  {/* Seção: Informações Básicas */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <div className="h-1 w-1 bg-primary rounded-full" />
                      Informações Básicas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="nome" className="text-sm font-bold ml-1">Nome Completo</Label>
                          <Input
                          id="nome"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder="Nome do funcionário"
                          required
                          className="h-12 text-base rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20"
                          />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm font-bold ml-1">Email Corporativo</Label>
                          <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="funcionario@farmacia.com"
                          required
                          disabled={!!editingUser}
                          className="h-12 text-base rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20"
                          />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="tipo" className="text-sm font-bold ml-1">Função</Label>
                          <Select value={tipo} onValueChange={(value: 'SUPER_ADMIN' | 'ADMIN' | 'COMUM') => setTipo(value)}>
                          <SelectTrigger className="h-12 text-base rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none shadow-xl">
                              <SelectItem value="COMUM">Farmacêutico / Atendente</SelectItem>
                              <SelectItem value="ADMIN">Administrador da Unidade</SelectItem>
                              {currentUser?.tipo === 'SUPER_ADMIN' && (
                                  <SelectItem value="SUPER_ADMIN">Super Administrador (SaaS)</SelectItem>
                              )}
                          </SelectContent>
                          </Select>
                      </div>

                      <div className="space-y-2">
                          <Label htmlFor="unidade" className="text-sm font-bold ml-1">Unidade de Saúde</Label>
                          <Select value={unidadeId} onValueChange={setUnidadeId}>
                          <SelectTrigger className="h-12 text-base rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20">
                              <SelectValue placeholder="Selecione uma unidade..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none shadow-xl">
                              {unidades?.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                              ))}
                          </SelectContent>
                          </Select>
                      </div>
                    </div>
                  </div>

                  {/* Seção: Acesso e Módulos */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <div className="h-1 w-1 bg-primary rounded-full" />
                      Módulos e Acessos
                    </h3>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold ml-1">Módulos Liberados</Label>
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
                          moduloOptions.forEach(opt => {
                            newPerms[opt.value as keyof UserPermissions] = false;
                          });
                          selected.forEach(val => {
                            newPerms[val as keyof UserPermissions] = true;
                          });
                          setPermissoes(newPerms);
                        }}
                        placeholder="Selecione os módulos..."
                        disabled={tipo === 'ADMIN'}
                        className="min-h-12 text-base rounded-2xl bg-muted/30 border-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { 
                          id: 'pode_excluir', 
                          label: 'Permitir Exclusão', 
                          desc: 'Apagar registros de pacientes e produtos',
                          icon: ShieldAlert,
                          color: 'text-destructive',
                          bg: 'bg-destructive/5'
                        },
                        { 
                          id: 'acesso_global_pedidos', 
                          label: 'Acesso Global Pedidos', 
                          desc: 'Ver pedidos de todas as unidades',
                          icon: Zap,
                          color: 'text-blue-500',
                          bg: 'bg-blue-500/5'
                        },
                        { 
                          id: 'usar_tipo_dispensacao', 
                          label: 'Procedimento na Dispensação', 
                          desc: 'Habilita seleção de entrega total/parcial',
                          icon: BookOpen,
                          color: 'text-emerald-500',
                          bg: 'bg-emerald-500/5'
                        }
                      ].map((perm) => (
                        <label
                          key={perm.id}
                          htmlFor={perm.id}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                            permissoes[perm.id as keyof UserPermissions] 
                              ? "border-primary/20 bg-primary/5" 
                              : "border-transparent bg-muted/30 opacity-70 grayscale-[0.5]"
                          )}
                        >
                          <div className={cn("p-2 rounded-xl", perm.bg)}>
                            <perm.icon className={cn("h-5 w-5", perm.color)} />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-black leading-none mb-1">{perm.label}</p>
                            <p className="text-[11px] text-muted-foreground font-medium leading-tight">{perm.desc}</p>
                          </div>
                          <Checkbox
                            id={perm.id}
                            checked={permissoes[perm.id as keyof UserPermissions] as boolean}
                            onCheckedChange={(checked) => 
                              handlePermissionChange(perm.id as keyof UserPermissions, checked as boolean)
                            }
                            disabled={tipo === 'ADMIN'}
                            className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  {tipo === 'ADMIN' && (
                      <div className="bg-blue-500/10 p-4 rounded-2xl flex gap-3">
                        <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                        <p className="text-xs text-blue-700 font-bold leading-relaxed">
                          Administradores possuem acesso total (CRUD) em todos os módulos por padrão.
                        </p>
                      </div>
                  )}

                  <div className="flex flex-col gap-3 pt-4">
                    <Button type="submit" disabled={saveUserMutation.isPending} className="h-14 rounded-2xl font-black text-base shadow-lg shadow-primary/20">
                        {saveUserMutation.isPending 
                        ? 'Salvando...' 
                        : editingUser ? 'Salvar Alterações' : 'Concluir Convite'
                        }
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 rounded-2xl font-bold text-muted-foreground">
                        Cancelar
                    </Button>
                  </div>
              </form>
            </ScrollArea>
            </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none sm:border bg-transparent sm:bg-card shadow-none sm:shadow-sm">
        <CardHeader className="px-0 sm:px-6">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            Membros Ativos
            <Badge variant="secondary" className="rounded-full">{usuarios?.length || 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {isLoading ? (
            <div className="text-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground font-medium">Carregando equipe...</p>
            </div>
          ) : isMobile ? (
            <div className="grid grid-cols-1 gap-4">
              {usuarios?.map((usuario) => (
                <div key={usuario.id} className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm active:scale-[0.98] transition-transform">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="font-bold text-lg leading-none">{usuario.nome}</h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 text-primary/70" />
                        <span className="truncate max-w-[180px]">{usuario.email}</span>
                      </div>
                    </div>
                    <Badge 
                      variant={usuario.tipo === 'SUPER_ADMIN' ? 'destructive' : usuario.tipo === 'ADMIN' ? 'default' : 'secondary'}
                      className="rounded-full text-[10px] font-black uppercase tracking-wider"
                    >
                      {usuario.tipo === 'SUPER_ADMIN' ? 'Super Admin' : usuario.tipo === 'ADMIN' ? 'Admin' : 'Membro'}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-full text-[11px] font-bold text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      {usuario.unidade_nome || 'Sem unidade'}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-full text-[11px] font-bold text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      {new Date(usuario.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t border-border/50">
                    <Button
                      size="lg"
                      variant="secondary"
                      onClick={() => openEditDialog(usuario)}
                      className="flex-1 h-12 rounded-xl font-bold gap-2 text-sm"
                    >
                      <Edit className="h-4 w-4" />
                      Editar Permissões
                    </Button>
                    
                    {(currentUser?.tipo === 'SUPER_ADMIN' || currentUser?.tipo === 'ADMIN') && usuario.id !== currentUser?.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-12 w-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => {
                          setUserToDelete(usuario);
                          setIsDeleteAlertOpen(true);
                        }}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(!usuarios || usuarios.length === 0) && (
                <div className="text-center py-12 bg-muted/30 rounded-2xl border-2 border-dashed border-border">
                  <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                  <p className="text-muted-foreground font-medium">Nenhum membro encontrado.</p>
                </div>
              )}
            </div>
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
                        variant={usuario.tipo === 'SUPER_ADMIN' ? 'destructive' : usuario.tipo === 'ADMIN' ? 'default' : 'secondary'}
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
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
