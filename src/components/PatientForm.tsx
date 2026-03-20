import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, Save, UserPlus, Trash2, Edit, X, Search, MapPin, Phone, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Patient } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionCheck } from "@/components/auth/PermissionCheck";
import { SmartDatePicker } from "@/components/ui/smart-date-picker";

export function PatientForm() {
  const { toast } = useToast();
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    sus_cpf: '',
    endereco: '',
    bairro: '',
    telefone: '',
    nascimento: '',
  });

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return 0;
    try {
      const today = new Date();
      const birth = new Date(birthDate + "T12:00:00");
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch (e) {
      return 0;
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  const validateSusCpf = (value: string) => {
    // Remove todos os caracteres não numéricos
    const numbersOnly = value.replace(/\D/g, '');
    
    // Limita a 15 dígitos
    if (numbersOnly.length > 15) {
      return numbersOnly.substring(0, 15);
    }
    
    return numbersOnly;
  };

  const handleInputChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'telefone') {
      formattedValue = formatPhone(value);
    } else if (field === 'sus_cpf') {
      formattedValue = validateSusCpf(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: formattedValue
    }));
  };

  const loadPatients = async (search = '') => {
    try {
      setIsSearching(true);
      let query = supabase
        .from('pacientes')
        .select(`
          *,
          tenant:tenant_id (
            name
          )
        `, { count: 'exact' });

      if (search) {
        // Busca por nome, SUS/CPF ou telefone
        query = query.or(`nome.ilike.%${search}%,sus_cpf.ilike.%${search}%,telefone.ilike.%${search}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .limit(search ? 100 : 10);

      if (error) throw error;
      
      // Atualiza o total apenas se não houver busca
      if (!search && count !== null) {
        setTotalPatients(count);
      }
      
      const mappedPatients = data?.map(p => ({
        ...p,
        tenant_name: p.tenant?.name || 'Unidade Desconhecida'
      })) || [];

      setPatients(mappedPatients as any);
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error);
      toast({
        title: "Erro ao carregar pacientes",
        description: "Não foi possível carregar a lista de pacientes.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';

  // Debounce na busca
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPatients(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleEdit = (patient: Patient) => {
    if (!hasPermission('cadastro_pacientes')) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para editar pacientes.",
        variant: "destructive",
      });
      return;
    }
    
    setEditingPatient(patient);
    setFormData({
      nome: patient.nome,
      sus_cpf: patient.sus_cpf,
      endereco: patient.endereco,
      bairro: patient.bairro,
      telefone: patient.telefone,
      nascimento: patient.nascimento,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingPatient(null);
    setFormData({
      nome: '',
      sus_cpf: '',
      endereco: '',
      bairro: '',
      telefone: '',
      nascimento: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validações
      if (!formData.nome || !formData.sus_cpf || !formData.endereco || 
          !formData.bairro || !formData.telefone || !formData.nascimento) {
        throw new Error('Todos os campos são obrigatórios');
      }

      // Validação específica do SUS/CPF
      const susCpfNumbers = formData.sus_cpf.replace(/\D/g, '');
      if (susCpfNumbers.length < 11 || susCpfNumbers.length > 15) {
        throw new Error('SUS/CPF deve conter entre 11 e 15 números');
      }

      if (!/^\d+$/.test(susCpfNumbers)) {
        throw new Error('SUS/CPF deve conter apenas números');
      }

      const idade = calculateAge(formData.nascimento);
      
      if (editingPatient) {
        // Atualizar paciente existente
        const { error } = await supabase
          .from('pacientes')
          .update({
            nome: formData.nome,
            sus_cpf: susCpfNumbers,
            endereco: formData.endereco,
            bairro: formData.bairro,
            telefone: formData.telefone,
            nascimento: formData.nascimento,
            idade: idade
          })
          .eq('id', editingPatient.id);

        if (error) {
          console.error('Erro ao atualizar paciente:', error);
          
          // Verificar se é erro de duplicata de SUS/CPF
          if (error.code === '23505' && error.message.includes('pacientes_sus_cpf_unique')) {
            throw new Error('SUS já cadastrado');
          }
          
          throw error;
        }
        
        toast({
          title: "Paciente atualizado com sucesso!",
          description: `Os dados de ${formData.nome} foram atualizados.`,
        });
        
        setEditingPatient(null);
      } else {
        // Criar novo paciente
        const { error } = await supabase
          .from('pacientes')
          .insert([{
            nome: formData.nome,
            sus_cpf: susCpfNumbers,
            endereco: formData.endereco,
            bairro: formData.bairro,
            telefone: formData.telefone,
            nascimento: formData.nascimento,
            idade: idade,
            tenant_id: user?.tenant_id || '00000000-0000-0000-0000-000000000000',
            unidade_id: user?.unidade_id
          }]);

        if (error) {
          console.error('Erro ao cadastrar paciente:', error);
          
          // Verificar se é erro de duplicata de SUS/CPF
          if (error.code === '23505' && error.message.includes('pacientes_sus_cpf_unique')) {
            throw new Error('SUS já cadastrado');
          }
          
          throw error;
        }
        
        toast({
          title: "Paciente cadastrado com sucesso!",
          description: `${formData.nome} foi adicionado ao sistema.`,
        });
      }
      
      // Reset form
      setFormData({
        nome: '',
        sus_cpf: '',
        endereco: '',
        bairro: '',
        telefone: '',
        nascimento: '',
      });

      // Recarregar lista
      await loadPatients(searchTerm);
      
    } catch (error) {
      console.error('Erro no handleSubmit:', error);
      
      let errorTitle = editingPatient ? "Erro ao atualizar paciente" : "Erro ao cadastrar paciente";
      let errorDescription = "Erro desconhecido";
      
      if (error instanceof Error) {
        if (error.message === 'SUS já cadastrado') {
          errorTitle = "SUS já cadastrado";
          errorDescription = "Um paciente com este SUS/CPF já existe no sistema.";
        } else {
          errorDescription = error.message;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!hasPermission('pode_excluir')) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para excluir registros.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o paciente ${nome}?`)) return;

    try {
      const { error } = await supabase
        .from('pacientes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Paciente excluído",
        description: `${nome} foi removido do sistema.`,
      });

      await loadPatients(searchTerm);
    } catch (error) {
      toast({
        title: "Erro ao excluir paciente",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const idade = calculateAge(formData.nascimento);

  return (
    <div className="space-y-6 md:space-y-10 pb-24 md:pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6 md:pb-8">
        <div className="flex items-center gap-3 md:gap-5">
          <div className="p-2.5 md:p-3 bg-primary/10 rounded-xl md:rounded-2xl shrink-0">
            <Users className="h-6 w-6 md:h-10 md:w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-5xl font-black tracking-tight text-foreground leading-tight">Pacientes</h1>
            <p className="text-muted-foreground text-sm md:text-xl mt-0.5 md:mt-2 font-medium">Gerencie o cadastro de usuários da SMSA</p>
          </div>
        </div>
      </div>

      <Card className="border-border bg-card shadow-xl rounded-2xl md:rounded-3xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-primary/5 blur-3xl -mr-16 -mt-16 md:-mr-32 md:-mt-32" />
        
        <CardHeader className="p-5 md:p-8 relative">
          <CardTitle className="flex items-center gap-3 text-xl md:text-3xl font-black tracking-tighter">
            <div className="p-2 bg-primary/10 rounded-lg">
              {editingPatient ? <Edit className="h-5 w-5 text-primary" /> : <UserPlus className="h-5 w-5 text-primary" />}
            </div>
            {editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
          </CardTitle>
          <CardDescription className="text-xs md:text-base font-medium mt-2">
            {editingPatient 
              ? 'Atualize os dados do paciente selecionado'
              : 'Preencha os dados obrigatórios para cadastrar um novo paciente'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 md:p-8 md:pt-0 relative">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="h-12 text-[16px] rounded-xl border-border bg-background"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sus_cpf" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SUS/CPF *</Label>
                <Input
                  id="sus_cpf"
                  value={formData.sus_cpf}
                  onChange={(e) => handleInputChange('sus_cpf', e.target.value)}
                  placeholder="Apenas números (11 a 15 dígitos)"
                  maxLength={15}
                  className="h-12 text-[16px] rounded-xl border-border bg-background"
                  required
                />
                {formData.sus_cpf && (
                  <p className={`text-[10px] font-black uppercase tracking-widest ${
                    formData.sus_cpf.length >= 11 && formData.sus_cpf.length <= 15 
                      ? 'text-secondary' 
                      : 'text-destructive'
                  }`}>
                    {formData.sus_cpf.length} dígitos {formData.sus_cpf.length < 11 ? '(mínimo 11)' : formData.sus_cpf.length > 15 ? '(máximo 15)' : '✓'}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  Endereço Completo *
                </Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => handleInputChange('endereco', e.target.value)}
                  placeholder="Rua, número, complemento..."
                  className="h-12 text-[16px] rounded-xl border-border bg-background"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bairro" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bairro/Cidade *</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) => handleInputChange('bairro', e.target.value)}
                  placeholder="Ex: Centro - Cidade"
                  className="h-12 text-[16px] rounded-xl border-border bg-background"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  Telefone *
                </Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleInputChange('telefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="h-12 text-[16px] rounded-xl border-border bg-background"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nascimento" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Data de Nascimento *
                </Label>
                <SmartDatePicker
                  id="nascimento"
                  value={formData.nascimento}
                  onChange={(val) => handleInputChange('nascimento', val)}
                />
                {idade > 0 && (
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Idade: {idade} anos</p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-border/50">
              <div className="flex gap-3 w-full sm:w-auto">
                {editingPatient && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit} className="flex-1 sm:flex-none h-12 md:h-14 px-6 rounded-xl font-bold border-border">
                    <X className="h-5 w-5 mr-2" />
                    Cancelar
                  </Button>
                )}
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setFormData({
                    nome: '', sus_cpf: '', endereco: '', bairro: '', telefone: '', nascimento: ''
                  })}
                  className="flex-1 sm:flex-none h-12 md:h-14 px-6 rounded-xl font-bold text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </Button>
              </div>
              <PermissionCheck permission="cadastro_pacientes">
                <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 md:h-14 px-8 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-none active:scale-95 transition-all">
                  <Save className="h-5 w-5 mr-2" />
                  {loading 
                    ? (editingPatient ? 'Atualizando...' : 'Salvando...') 
                    : (editingPatient ? 'Atualizar Cadastro' : 'Salvar Paciente')
                  }
                </Button>
              </PermissionCheck>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de pacientes */}
      <Card className="border-border bg-card shadow-lg rounded-2xl md:rounded-3xl overflow-hidden">
        <CardHeader className="p-5 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1">
              <CardTitle className="text-xl md:text-2xl font-black tracking-tight">
                {searchTerm ? `Pacientes Encontrados (${patients.length})` : `Pacientes Cadastrados (${totalPatients})`}
              </CardTitle>
              <CardDescription className="text-xs md:text-sm font-medium">
                {searchTerm ? "Resultados da busca no sistema" : "Últimos registros da SMSA"}
              </CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 ${isSearching ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
              <Input
                placeholder="Nome, SUS ou Telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 w-full text-[16px] bg-muted/20 border-border focus:bg-background transition-all rounded-xl"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-8 md:pt-0">
          <div className="divide-y divide-border border-t md:border-none">
            {isSearching && patients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <p className="text-muted-foreground mt-4 font-bold text-sm">Buscando na base...</p>
              </div>
            ) : patients.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground font-medium italic">
                  {searchTerm ? "Nenhum paciente encontrado." : "Nenhum paciente cadastrado."}
                </p>
              </div>
            ) : (
              patients.map((patient) => (
                <div key={patient.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 md:p-6 md:border md:rounded-2xl hover:bg-muted/30 transition-all gap-4 mb-2">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center flex-wrap gap-2">
                      <p className="font-black text-base md:text-lg text-foreground leading-tight">{patient.nome}</p>
                      {isSuperAdmin && (
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-primary/30 text-primary bg-primary/5">
                          {(patient as any).tenant_name}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">SUS: {patient.sus_cpf}</span>
                      <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md">{patient.idade} anos</span>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" />
                      {patient.endereco}, {patient.bairro}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      {patient.telefone}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 border-t sm:border-none pt-4 sm:pt-0">
                    <PermissionCheck permission="cadastro_pacientes">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEdit(patient)}
                        className="flex-1 sm:flex-none h-10 px-4 rounded-xl font-bold gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                    </PermissionCheck>
                    
                    <PermissionCheck permission="pode_excluir">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(patient.id, patient.nome)}
                        className="flex-1 sm:flex-none h-10 px-4 rounded-xl font-bold text-destructive hover:bg-destructive/10 gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    </PermissionCheck>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
