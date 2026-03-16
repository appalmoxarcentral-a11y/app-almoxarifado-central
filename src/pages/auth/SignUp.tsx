import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, Link } from 'react-router-dom';

export function SignUp() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const formatTelefone = (value: string) => {
    // Remove tudo que não é dígito
    const digits = value.replace(/\D/g, '');
    
    // Limita a 11 dígitos
    const limitedDigits = digits.slice(0, 11);
    
    // Aplica a máscara (XX) 9XXXX-XXXX
    if (limitedDigits.length <= 2) {
      return limitedDigits;
    } else if (limitedDigits.length <= 7) {
      return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
    } else {
      return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 7)}-${limitedDigits.slice(7)}`;
    }
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTelefone(e.target.value);
    setTelefone(formatted);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica do telefone (mínimo 11 dígitos: 2 DDD + 9 dígitos)
    const phoneDigits = telefone.replace(/\D/g, '');
    if (phoneDigits.length < 11) {
      toast({
        variant: "destructive",
        title: "Telefone inválido",
        description: "Por favor, insira o telefone completo com DDD e o nono dígito.",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            full_name: nome,
            phone: telefone,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Se o Supabase fizer login automático, encerramos a sessão para forçar o login manual
        // Não usamos 'await' aqui para evitar que a atualização de estado do AuthContext
        // interrompa o fluxo de navegação do componente atual
        if (data.session) {
          supabase.auth.signOut();
        }

        toast({
          title: "Conta criada com sucesso!",
          description: "Bem-vindo ao Stock Guardian. Por favor, faça login para acessar sua conta.",
        });
        
        // Pequeno atraso para garantir que a navegação ocorra após o processamento inicial
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 200);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro no cadastro",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Criar Conta</CardTitle>
          <CardDescription className="text-center">
            Comece a gerenciar seu estoque hoje mesmo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input
                id="nome"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">WhatsApp / Telefone</Label>
              <Input
                id="telefone"
                required
                value={telefone}
                onChange={handleTelefoneChange}
                placeholder="(00) 90000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="******"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando conta...' : 'Cadastrar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <Link to="/login" className="font-medium text-primary hover:text-primary/80">
              Fazer Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
