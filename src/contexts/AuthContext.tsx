
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, UserPermissions } from '@/types';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  hasPermission: (permission: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Configurar listener para mudanças de autenticação do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Usuário logado no Supabase - buscar dados na tabela usuarios
          setTimeout(async () => {
            await loadUserData(session.user.email!);
          }, 0);
        } else {
          // Usuário não logado
          setUser(null);
          localStorage.removeItem('currentUser');
        }
      }
    );

    // Verificar sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadUserData(session.user.email!);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (email: string) => {
    try {
      const { data: users, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .eq('ativo', true)
        .limit(1);

      if (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        return;
      }

      if (users && users.length > 0) {
        const usuario = users[0];
        const userData: User = {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          tipo: usuario.tipo as 'ADMIN' | 'COMUM',
          permissoes: (usuario.permissoes as unknown) as UserPermissions,
          ativo: usuario.ativo,
          created_at: usuario.created_at
        };

        setUser(userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

      // Verificar/criar usuário no Supabase Auth
      let authUser: SupabaseUser | null = null;
      
      // Tentar fazer login no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: senha
      });

      if (authError && authError.message.includes('Invalid login credentials')) {
        // Usuário não existe no Supabase Auth - criar conta
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password: senha,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });

        if (signUpError) {
          console.error('Erro ao criar usuário no Supabase Auth:', signUpError);
          return false;
        }

        authUser = signUpData.user;
      } else if (authError) {
        console.error('Erro no login Supabase Auth:', authError);
        return false;
      } else {
        authUser = authData.user;
      }

      // Se chegou aqui, o login foi bem-sucedido
      // Os dados do usuário serão carregados pelo onAuthStateChange
      return true;
    } catch (error) {
      console.error('Erro no login:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Fazer logout do Supabase Auth
      await supabase.auth.signOut();
      // Os estados serão limpos pelo onAuthStateChange
    } catch (error) {
      console.error('Erro no logout:', error);
      // Limpar estados localmente em caso de erro
      setUser(null);
      setSession(null);
      localStorage.removeItem('currentUser');
    }
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
