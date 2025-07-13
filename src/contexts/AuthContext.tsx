
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
        
        // Definir contexto de usuário para RLS quando carregado do localStorage
        supabase.rpc('set_current_user_id', { user_id_param: userData.id })
          .then(({ error }) => {
            if (error) console.error('Erro ao definir contexto do usuário:', error);
          });
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

      // Buscar usuário por email na tabela usuarios
      const { data: users, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('ativo', true)
        .limit(1);

      if (error) {
        console.error('Erro na consulta:', error);
        return false;
      }

      if (!users || users.length === 0) {
        console.log('Usuário não encontrado ou inativo');
        return false;
      }

      const usuario = users[0];

      // Verificar senha usando a função hash_senha do banco
      const { data: hashResult, error: hashError } = await supabase
        .rpc('hash_senha', { senha_texto: senha });

      if (hashError) {
        console.error('Erro ao verificar senha:', hashError);
        return false;
      }

      if (hashResult !== usuario.senha) {
        console.log('Senha incorreta');
        return false;
      }

      // Criar objeto de usuário
      const userData: User = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo as 'ADMIN' | 'COMUM',
        permissoes: (usuario.permissoes as unknown) as UserPermissions,
        ativo: usuario.ativo,
        created_at: usuario.created_at
      };

      // Definir contexto de usuário para RLS
      await supabase.rpc('set_current_user_id', { user_id_param: usuario.id });

      // Salvar dados do usuário
      setUser(userData);
      localStorage.setItem('currentUser', JSON.stringify(userData));

      return true;
    } catch (error) {
      console.error('Erro no login:', error);
      return false;
    } finally {
      setIsLoading(false);
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
