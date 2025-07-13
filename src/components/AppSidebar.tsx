
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { 
  Home, 
  Users, 
  Package, 
  PackagePlus, 
  Pill, 
  History, 
  UserCog, 
  LogOut,
  ShoppingCart,
  ChevronRight
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { 
      title: 'Dashboard', 
      url: '/', 
      icon: Home,
      permission: null
    },
    { 
      title: 'Cadastro de Pacientes', 
      url: '/pacientes', 
      icon: Users,
      permission: 'cadastro_pacientes'
    },
    { 
      title: 'Cadastro de Produtos', 
      url: '/produtos', 
      icon: Package,
      permission: 'cadastro_produtos'
    },
    { 
      title: 'Entrada de Produtos', 
      url: '/entradas', 
      icon: PackagePlus,
      permission: 'entrada_produtos'
    },
    { 
      title: 'Dispensação', 
      url: '/dispensacao', 
      icon: Pill,
      permission: 'dispensacao'
    },
    { 
      title: 'Históricos', 
      url: '/historicos', 
      icon: History,
      permission: 'historicos'
    },
    { 
      title: 'Relatório de Compras', 
      url: '/relatorio-compras', 
      icon: ShoppingCart,
      permission: 'relatorio_compras'
    }
  ];

  // Itens específicos para administradores
  const adminItems = [
    {
      title: 'Gestão de Usuários',
      url: '/usuarios',
      icon: UserCog,
      permission: 'gestao_usuarios'
    }
  ];

  const hasPermission = (permission: string | null) => {
    if (!permission) return true;
    if (!user) return false;
    if (user.tipo === 'ADMIN') return true;
    return user.permissoes?.[permission] === true;
  };

  const canAccessUsers = hasPermission('gestao_usuarios');

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Pill className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">UBSF</h2>
            <p className="text-xs text-muted-foreground">Sistema Farmácia</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {menuItems
            .filter(item => hasPermission(item.permission))
            .map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild 
                  isActive={isActive(item.url)}
                  className="cursor-pointer"
                >
                  <div onClick={() => navigate(item.url)} className="flex items-center gap-2">
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

          {/* Seção Administrativa */}
          {canAccessUsers && (
            <Collapsible className="group/collapsible">
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
                      <SidebarMenuSubButton 
                        asChild 
                        isActive={isActive('/usuarios')}
                        className="cursor-pointer"
                      >
                        <div onClick={() => navigate('/usuarios')} className="flex items-center gap-2">
                          <UserCog className="w-4 h-4" />
                          <span>Gestão de Usuários</span>
                        </div>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="space-y-2">
          <div className="text-sm">
            <p className="font-medium">{user?.nome}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <p className="text-xs text-muted-foreground">
              {user?.tipo === 'ADMIN' ? 'Administrador' : 'Usuário Comum'}
            </p>
          </div>
          <SidebarMenuButton 
            className="w-full cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
