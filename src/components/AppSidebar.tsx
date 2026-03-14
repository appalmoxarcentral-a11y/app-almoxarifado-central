import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from '@/components/ui/sidebar';
import { Home, Users, Package, PackagePlus, Pill, History, UserCog, LogOut, ShoppingCart, ChevronRight, CreditCard } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
export function AppSidebar() {
  const {
    user,
    logout,
    isImpersonating
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const isActive = (path: string) => location.pathname === path;

  const menuItems = [{
    title: 'Dashboard',
    url: '/',
    icon: Home,
    permission: null
  }, {
    title: 'Cadastro de Pacientes',
    url: '/pacientes',
    icon: Users,
    permission: 'cadastro_pacientes'
  }, {
    title: 'Cadastro de Produtos',
    url: '/produtos',
    icon: Package,
    permission: 'cadastro_produtos'
  }, {
    title: 'Entrada de Produtos',
    url: '/entradas',
    icon: PackagePlus,
    permission: 'entrada_produtos'
  }, {
    title: 'Dispensação',
    url: '/dispensacao',
    icon: Pill,
    permission: 'dispensacao'
  }, {
    title: 'Históricos',
    url: '/historicos',
    icon: History,
    permission: 'historicos'
  }, {
    title: 'Relatório de Compras',
    url: '/relatorio-compras',
    icon: ShoppingCart,
    permission: 'relatorio_compras'
  }];
  
  const hasPermission = (permission: string | null) => {
    if (!permission) return true;
    if (!user) return false;
    // Administradores e Super Admins (ou quando em modo Impersonation) têm acesso total
    if (user.tipo === 'SUPER_ADMIN' || user.tipo === 'ADMIN' || isImpersonating) return true;
    return user.permissoes?.[permission as keyof typeof user.permissoes] === true;
  };
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';
  const isSubscriptionBlocked = user?.subscription_blocked && !isSuperAdmin;
  const canAccessUsers = hasPermission('gestao_usuarios');

  const filteredMenuItems = menuItems.filter(item => {
    // Primeiro, checa permissão básica
    if (!hasPermission(item.permission)) return false;
    
    // Se estiver bloqueado, apenas Dashboard é permitido
    if (isSubscriptionBlocked && item.url !== '/') return false;
    
    return true;
  });

  return <Sidebar>
      <SidebarHeader className="border-b p-4 bg-fuchsia-950">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Pill className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">SMSA</h2>
            <p className="text-xs text-muted-foreground">Sistema Farmácia</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-[#5c0d2b]">
        <SidebarMenu>
          {filteredMenuItems.map(item => <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={isActive(item.url)} className="cursor-pointer">
                  <div onClick={() => navigate(item.url)} className="flex items-center gap-2">
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>)}

          {/* SaaS Admin para Super Admin (Nunca bloqueado) */}
          {isSuperAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive('/admin')} className="cursor-pointer">
                <div onClick={() => navigate('/admin')} className="flex items-center gap-2">
                  <UserCog className="w-4 h-4" />
                  <span>SaaS Admin</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {/* Assinatura (Sempre visível para Admin/SuperAdmin, ou para todos se estiver bloqueado) */}
          {user?.tenant_id && (user?.tipo === 'ADMIN' || user?.tipo === 'SUPER_ADMIN' || isSubscriptionBlocked) && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive('/assinatura')} className="cursor-pointer">
                <div onClick={() => navigate('/assinatura')} className="flex items-center gap-2 text-red-500 font-semibold">
                  <CreditCard className={`w-4 h-4 ${isSubscriptionBlocked ? 'animate-pulse' : ''}`} />
                  <span>{isSubscriptionBlocked ? 'Assinatura Pendente' : 'Assinatura'}</span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {/* Seção Administrativa (Oculta se bloqueado) */}
          {!isSubscriptionBlocked && canAccessUsers && <Collapsible className="group/collapsible">
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="cursor-pointer">
                    <UserCog className="w-4 h-4" />
                    <span>Administração</span>
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={isActive('/usuarios')} className="cursor-pointer">
                        <div onClick={() => navigate('/usuarios')} className="flex items-center gap-2">
                          <UserCog className="w-4 h-4" />
                          <span>Gestão de Usuários</span>
                        </div>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t p-4 bg-fuchsia-950">
        <div className="space-y-2">
          <div className="text-sm">
            <p className="font-medium">{user?.nome}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              {user?.tipo === 'SUPER_ADMIN' ? 'Super Administrador' : 
               user?.tipo === 'ADMIN' ? 'Administrador' : 'Usuário Comum'}
            </p>
          </div>
          <SidebarMenuButton className="w-full cursor-pointer hover:bg-destructive hover:text-destructive-foreground" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>;
}