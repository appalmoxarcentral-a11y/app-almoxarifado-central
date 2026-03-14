import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Search, MapPin, Building2, CheckCircle2, Loader2, ArrowRight, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Unidade {
  id: string;
  nome: string;
  codigo: string;
  endereco: string;
  bairro: string;
  cidade: string;
  ativo: boolean;
}

export function SelectUnidade() {
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bairros, setBairros] = useState<string[]>([]);
  const [selectedBairro, setSelectedBairro] = useState<string>('todos');

  useEffect(() => {
    fetchUnidades();
  }, []);

  const fetchUnidades = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('unidades_saude')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      
      setUnidades(data || []);
      
      // Extrair bairros únicos
      const uniqueBairros = Array.from(new Set(data?.map(u => u.bairro).filter(Boolean) as string[]));
      setBairros(uniqueBairros.sort());
    } catch (error: any) {
      console.error('Erro ao buscar unidades:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar unidades',
        description: 'Não foi possível carregar a lista de unidades de saúde.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (unidadeId: string) => {
    if (!user) return;
    
    try {
      setSelecting(unidadeId);
      
      // 1. Atualizar o perfil do usuário com a unidade selecionada
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ unidade_id: unidadeId })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast({
        title: 'Unidade selecionada!',
        description: 'Seu acesso foi vinculado com sucesso.',
      });

      // 2. Atualizar contexto e navegar
      console.log('[SelectUnidade] Vinculo realizado, solicitando refreshProfile...');
      await refreshProfile();
      
      // Pequeno delay para garantir que o estado do React foi atualizado
      setTimeout(() => {
        console.log('[SelectUnidade] Redirecionando para home...');
        navigate('/', { replace: true });
      }, 100);
    } catch (error: any) {
      console.error('Erro ao selecionar unidade:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao vincular unidade',
        description: error.message || 'Ocorreu um erro ao tentar vincular sua conta.',
      });
    } finally {
      setSelecting(null);
    }
  };

  const filteredUnidades = unidades.filter(u => {
    const matchesSearch = u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (u.bairro && u.bairro.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesBairro = selectedBairro === 'todos' || u.bairro === selectedBairro;
    
    return matchesSearch && matchesBairro;
  });

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center">
      <div className="w-full max-w-5xl px-4 py-12 md:py-20 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm">
            <Building2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900">
              Selecione sua Unidade de Saúde
            </h1>
            <p className="text-zinc-500 max-w-md mx-auto">
              Para continuar, você precisa estar vinculado a uma unidade de atendimento.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-emerald-400 transition-colors" />
            <Input
              placeholder="Buscar por nome, código ou bairro..."
              className="h-14 pl-12 bg-[#060C14] border-none text-white placeholder:text-zinc-500 rounded-2xl shadow-xl focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-72">
            <select
              className="w-full h-14 px-4 bg-white border border-zinc-200 text-zinc-700 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all appearance-none cursor-pointer"
              value={selectedBairro}
              onChange={(e) => setSelectedBairro(e.target.value)}
            >
              <option value="todos">Todos os Bairros</option>
              {bairros.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Units List/Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
            <p className="text-sm text-zinc-500 font-medium">Carregando unidades disponíveis...</p>
          </div>
        ) : filteredUnidades.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            {filteredUnidades.map((unidade) => (
              <div 
                key={unidade.id} 
                className="group relative bg-white border border-zinc-200 rounded-[2rem] overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-500"
              >
                {/* Header do Card */}
                <div className="p-8 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-emerald-800 leading-tight uppercase">
                        {unidade.nome}
                      </h3>
                      <Badge variant="outline" className="bg-zinc-50 text-[10px] font-mono border-zinc-200 text-zinc-500 uppercase">
                        {unidade.codigo}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Dark Info Band */}
                <div className="bg-[#060C14] px-8 py-6 flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Localização</p>
                    <p className="text-zinc-100 text-sm truncate font-medium">
                      {unidade.endereco || '-'}
                    </p>
                    <p className="text-zinc-500 text-xs truncate">
                      {unidade.bairro} • {unidade.cidade}
                    </p>
                  </div>
                </div>

                {/* Footer do Card */}
                <div className="p-6 bg-white flex justify-end">
                  <Button 
                    className={cn(
                      "h-12 px-8 rounded-xl font-bold transition-all gap-2",
                      selecting === unidade.id 
                        ? "bg-zinc-100 text-zinc-400" 
                        : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200"
                    )}
                    disabled={selecting !== null}
                    onClick={() => handleSelect(unidade.id)}
                  >
                    {selecting === unidade.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                    Vincular Agora
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-[2rem] border-2 border-dashed border-zinc-200 space-y-6">
            <div className="mx-auto w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center">
              <Building2 className="h-10 w-10 text-zinc-300" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-zinc-900">Nenhuma unidade encontrada</h3>
              <p className="text-zinc-500 max-w-xs mx-auto">Tente ajustar sua busca ou filtro de bairro.</p>
            </div>
            <Button 
              variant="outline" 
              className="rounded-xl px-8 h-12 border-zinc-200 hover:bg-zinc-50 transition-colors"
              onClick={() => { setSearchTerm(''); setSelectedBairro('todos'); }}
            >
              Limpar Filtros
            </Button>
          </div>
        )}

        {/* Footer Info */}
        <div className="pt-12 border-t border-zinc-200 flex flex-col md:flex-row justify-between items-center gap-6 text-sm">
          <div className="flex items-center gap-3 text-zinc-400 bg-zinc-100/50 px-4 py-2 rounded-full border border-zinc-200/50">
            <Info className="h-4 w-4 text-emerald-500" />
            <span>Dúvidas? Entre em contato com o suporte.</span>
          </div>
          <Button 
            variant="ghost" 
            onClick={logout} 
            className="text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-all gap-2"
          >
            Sair do sistema
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
