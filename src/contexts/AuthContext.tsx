
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, UserPermissions } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  hasPermission: (permission: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar se há usuário logado no localStorage
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        
        // Usuário carregado do localStorage - RLS funciona automaticamente com auth.uid()
      } catch (error) {
        console.error('Erro ao carregar usuário do localStorage:', error);
        localStorage.removeItem('currentUser');
      }
    }
    setIsLoading(false);
  }, []);


  const login = async (email: string, senha: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Usar a função verificar_senha para autenticação segura
      const { data: userData, error } = await supabase
        .rpc('verificar_senha', { 
          usuario_email: email, 
          senha_input: senha 
        });

      if (error) {
        console.error('Erro na autenticação:', error);
        setIsLoading(false);
        return false;
      }

      if (!userData || !Array.isArray(userData) || userData.length === 0) {
        console.log('Credenciais inválidas ou usuário inativo');
        setIsLoading(false);
        return false;
      }

      const usuario = userData[0];

      if (!usuario || !usuario.id) {
        console.error('Dados do usuário inválidos:', usuario);
        setIsLoading(false);
        return false;
      }

      // Garantir que permissoes nunca seja null/undefined
      const defaultPermissions: UserPermissions = {
        cadastro_pacientes: false,
        cadastro_produtos: false,
        entrada_produtos: false,
        dispensacao: false,
        historicos: false,
        relatorio_compras: false,
        gestao_usuarios: false,
        gerenciar_rascunhos_compras: false,
      };

      const permissoes = usuario.permissoes 
        ? { ...defaultPermissions, ...(usuario.permissoes as unknown as Partial<UserPermissions>) }
        : defaultPermissions;

      // Criar objeto de usuário
      const userObject: User = {
        id: usuario.id,
        nome: usuario.nome || '',
        email: usuario.email || email,
        tipo: (usuario.tipo as 'ADMIN' | 'COMUM') || 'COMUM',
        permissoes,
        ativo: usuario.ativo ?? true,
        created_at: new Date().toISOString()
      };

      // Salvar dados do usuário
      localStorage.setItem('currentUser', JSON.stringify(userObject));
      setUser(userObject);
      setIsLoading(false);

      return true;
    } catch (error) {
      console.error('Erro no login:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const hasPermission = (permission: keyof UserPermissions): boolean => {
    if (!user) return false;
    if (user.tipo === 'ADMIN') return true;
    return user.permissoes[permission] || false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isLoading,
      hasPermission
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
