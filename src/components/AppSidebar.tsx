
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Package, PackagePlus, ShoppingCart, History, Settings, LogOut, Activity } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const menuItems = [{
  title: "Dashboard",
  url: "/",
  icon: LayoutDashboard
}, {
  title: "Pacientes",
  url: "/pacientes",
  icon: Users
}, {
  title: "Produtos",
  url: "/produtos",
  icon: Package
}, {
  title: "Entrada de Produtos",
  url: "/entradas",
  icon: PackagePlus
}, {
  title: "Dispensação",
  url: "/dispensacao",
  icon: ShoppingCart
}, {
  title: "Históricos",
  url: "/historicos",
  icon: History
}, {
  title: "Usuários",
  url: "/usuarios",
  icon: Settings
}];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 lg:h-8 lg:w-8 text-sidebar-primary" />
          <div className="min-w-0">
            <h2 className="text-sidebar-foreground font-bold text-lg lg:text-2xl xl:text-3xl leading-tight">
              FARMÁCIA CENTRAL
            </h2>
            <p className="text-xs lg:text-sm text-sidebar-foreground/70">Sistema de Controle</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === item.url} 
                    className="hover:bg-sidebar-accent py-3"
                  >
                    <button onClick={() => navigate(item.url)} className="flex items-center gap-3 w-full">
                      <item.icon className="h-4 w-4 lg:h-5 lg:w-5" />
                      <span className="text-sm lg:text-base">{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="space-y-2">
          <div className="text-xs text-sidebar-foreground/70">
            Usuário: {user?.nome || 'N/A'}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={logout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
