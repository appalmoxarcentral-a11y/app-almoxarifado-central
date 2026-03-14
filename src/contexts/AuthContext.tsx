import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, UserPermissions } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  refreshProfile: () => Promise<void>;
  impersonateUser: (userToImpersonate: User) => void;
  stopImpersonating: () => void;
  isImpersonating: boolean;
  originalUser: User | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const impersonateUser = (userToImpersonate: User) => {
    if (user?.tipo !== 'SUPER_ADMIN' && user?.tipo !== 'ADMIN') return;
    
    setOriginalUser(user);
    setUser({
      ...userToImpersonate,
      // Ao impersonar, mantemos o poder de CRUD total do Admin/Super Admin
      // conforme solicitado pelo usuário.
    });
    setIsImpersonating(true);
    
    toast({
      title: "Modo de Acesso Rápido Ativo",
      description: `Simulando acesso como ${userToImpersonate.nome}. Você possui acesso total.`,
    });
  };

  const stopImpersonating = () => {
    if (originalUser) {
      setUser(originalUser);
      setOriginalUser(null);
      setIsImpersonating(false);
      toast({
        title: "Modo de Acesso Rápido Encerrado",
        description: "Você retornou ao seu perfil original.",
      });
    }
  };

  // Função para carregar perfil
  const loadProfile = useCallback(async (userId: string, email: string) => {
    if (isImpersonating) return; // Não recarregar perfil se estiver impersonando
    console.log('[AuthContext] Iniciando loadProfile para:', userId);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AuthContext] Erro ao buscar perfil no Supabase:', error);
        setUser(null);
      } else if (profile) {
        console.log('[AuthContext] Dados brutos do perfil recebidos:', profile);

        // Mapear Profile para User (Legacy Adapter)
        const defaultPermissions: UserPermissions = {
          cadastro_pacientes: false,
          cadastro_produtos: false,
          entrada_produtos: false,
          dispensacao: false,
          historicos: false,
          relatorio_compras: false,
          gestao_usuarios: false,
          gerenciar_rascunhos_compras: false,
          pode_excluir: false,
        };

        // Cast do JSONB para UserPermissions
        const userPermissions = profile.permissions 
          ? { ...defaultPermissions, ...(profile.permissions as unknown as Partial<UserPermissions>) }
          : defaultPermissions;

        // Se não tiver tenant_id, tentar usar o Legacy Tenant
        let tenantId = profile.tenant_id;
        
        if (!tenantId) {
           // Fallback para legacy para todos se não tiver tenant (evita erros de RLS)
           tenantId = '00000000-0000-0000-0000-000000000000';
        }

        const role = (profile.role || '').toLowerCase();

        // Buscar nome da unidade se houver unidade_id
        let unidadeNome = undefined;
        if (profile.unidade_id) {
          const { data: unidadeData } = await supabase
            .from('unidades_saude')
            .select('nome')
            .eq('id', profile.unidade_id)
            .single();
          
          if (unidadeData) {
            unidadeNome = unidadeData.nome;
          }
        }

        // Garantir que Super Admin nunca seja bloqueado
        let isBlocked = false;
        if (role !== 'super_admin') {
          const { data: blockedCheck } = await supabase
            .rpc('is_tenant_blocked', { p_tenant_id: tenantId });
          isBlocked = !!blockedCheck;
        }

        const userData: User = {
          id: profile.id,
          nome: profile.full_name || email || 'Usuário',
          email: email || profile.email || '',
          tipo: role === 'super_admin' ? 'SUPER_ADMIN' : 
                role === 'admin' ? 'ADMIN' : 'COMUM',
          permissoes: userPermissions,
          ativo: true,
          created_at: profile.created_at,
          tenant_id: tenantId || undefined,
          unidade_id: profile.unidade_id || undefined,
          unidade_nome: unidadeNome,
          subscription_blocked: isBlocked
        };
        
        console.log('[AuthContext] Novo userData mapeado:', { id: userData.id, unidade_id: userData.unidade_id });

        // Evitar loops de atualização se os dados forem idênticos
        setUser(current => {
          if (JSON.stringify(current) === JSON.stringify(userData)) {
            console.log('[AuthContext] Dados do usuário idênticos ao estado atual, ignorando update');
            return current;
          }
          console.log('[AuthContext] Atualizando estado do usuário com novas informações');
          return userData;
        });
      }
    } catch (err) {
      console.error('[AuthContext] Erro inesperado ao carregar perfil:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setIsLoading(true);
      await loadProfile(session.user.id, session.user.email!);
    }
  };

  useEffect(() => {
    console.log('[AuthContext] Estado do usuário alterado:', user);
    console.log('[AuthContext] IsLoading:', isLoading);
  }, [user, isLoading]);

  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email!);
      } else {
        setIsLoading(false);
      }
    });

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        loadProfile(session.user.id, session.user.email!);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, senha: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        console.error('Erro no login:', error);
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: error.message === "Invalid login credentials" 
            ? "Email ou senha incorretos." 
            : "Erro ao realizar login. Verifique suas credenciais.",
        });
        setIsLoading(false);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Erro inesperado no login:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('currentUser');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const hasPermission = (permission: keyof UserPermissions): boolean => {
    if (!user) return false;
    // Administradores e Super Admins (ou quando em modo Impersonation) têm acesso total
    if (user.tipo === 'SUPER_ADMIN' || user.tipo === 'ADMIN' || isImpersonating) return true;
    return user.permissoes[permission] || false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isLoading,
      hasPermission,
      refreshProfile,
      impersonateUser,
      stopImpersonating,
      isImpersonating,
      originalUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
