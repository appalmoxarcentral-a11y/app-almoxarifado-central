import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarTrigger } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Package, PackagePlus, ShoppingCart, History, Settings, LogOut, Activity } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  return <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-8 w-8 text-sidebar-primary" />
          <div>
            <h2 className="text-sidebar-foreground font-bold mx-0 text-center text-2xl">FARMÁCIA CENTRAL</h2>
            <p className="text-sm text-sidebar-foreground/70">Sistema de Controle</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url} className="hover:bg-sidebar-accent">
                    <button onClick={() => navigate(item.url)} className="flex items-center gap-2 w-full">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="space-y-2">
          <div className="text-xs text-sidebar-foreground/70">
            Usuário: Admin
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>;
}