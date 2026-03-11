import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, Save, UserPlus, Trash2, Edit, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Patient } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionCheck } from "@/components/auth/PermissionCheck";

export function PatientForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
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
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
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

  const loadPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPatients(data || []);
      setFilteredPatients(data || []);
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error);
      toast({
        title: "Erro ao carregar pacientes",
        description: "Não foi possível carregar a lista de pacientes.",
        variant: "destructive",
      });
    }
  };

  // Filtrar pacientes por busca
  useEffect(() => {
    if (!searchTerm) {
      setFilteredPatients(patients);
    } else {
      const filtered = patients.filter(patient =>
        patient.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.sus_cpf.includes(searchTerm) ||
        patient.telefone.includes(searchTerm)
      );
      setFilteredPatients(filtered);
    }
  }, [searchTerm, patients]);

  useEffect(() => {
    loadPatients();
  }, []);

  const handleEdit = (patient: Patient) => {
    if (user?.tipo !== 'ADMIN') {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem editar pacientes. Entre em contato com o administrador do sistema.",
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
            idade: idade
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
      await loadPatients();
      
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
    if (user?.tipo !== 'ADMIN') {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem excluir pacientes. Entre em contato com o administrador do sistema.",
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

      await loadPatients();
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
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 md:h-8 md:w-8 text-primary" />
        <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Cadastro de Pacientes</h1>
          <p className="text-sm md:text-base text-muted-foreground">Gerencie os dados dos pacientes da UBSF</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            {editingPatient ? <Edit className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
          </CardTitle>
          <CardDescription className="text-sm">
            {editingPatient 
              ? 'Atualize os dados do paciente selecionado'
              : 'Preencha todos os campos obrigatórios para cadastrar um novo paciente'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  placeholder="Digite o nome completo"
                  className="h-12"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sus_cpf">SUS/CPF *</Label>
                <Input
                  id="sus_cpf"
                  value={formData.sus_cpf}
                  onChange={(e) => handleInputChange('sus_cpf', e.target.value)}
                  placeholder="Digite apenas números (11 a 15 dígitos)"
                  maxLength={15}
                  className="h-12"
                  required
                />
                {formData.sus_cpf && (
                  <p className={`text-xs md:text-sm ${
                    formData.sus_cpf.length >= 11 && formData.sus_cpf.length <= 15 
                      ? 'text-secondary' 
                      : 'text-destructive'
                  }`}>
                    {formData.sus_cpf.length} dígitos inseridos
                    {formData.sus_cpf.length < 11 && ' (mínimo 11)'}
                    {formData.sus_cpf.length > 15 && ' (máximo 15)'}
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco">Endereço Completo *</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => handleInputChange('endereco', e.target.value)}
                  placeholder="Rua, número, complemento"
                  className="h-12"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro/Cidade *</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) => handleInputChange('bairro', e.target.value)}
                  placeholder="Bairro - Cidade"
                  className="h-12"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => handleInputChange('telefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="h-12"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nascimento">Data de Nascimento *</Label>
                <Input
                  id="nascimento"
                  type="date"
                  value={formData.nascimento}
                  onChange={(e) => handleInputChange('nascimento', e.target.value)}
                  className="h-12"
                  required
                />
                {idade > 0 && (
                  <p className="text-xs md:text-sm text-muted-foreground">Idade: {idade} anos</p>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-end gap-2 md:gap-4">
              {editingPatient && (
                <Button type="button" variant="outline" onClick={handleCancelEdit} className="h-12 order-2 md:order-1">
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setFormData({
                  nome: '', sus_cpf: '', endereco: '', bairro: '', telefone: '', nascimento: ''
                })}
                className="h-12 order-3 md:order-2"
              >
                Limpar
              </Button>
              <Button type="submit" disabled={loading} className="flex items-center justify-center gap-2 h-12 order-1 md:order-3">
                <Save className="h-4 w-4" />
                {loading 
                  ? (editingPatient ? 'Atualizando...' : 'Salvando...') 
                  : (editingPatient ? 'Atualizar Paciente' : 'Salvar Paciente')
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de pacientes */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-lg md:text-xl">Pacientes Cadastrados ({filteredPatients.length})</CardTitle>
              <CardDescription className="text-sm">Lista dos pacientes no sistema</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 w-full md:w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredPatients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {searchTerm ? "Nenhum paciente encontrado com o termo de busca." : "Nenhum paciente cadastrado."}
              </p>
            ) : (
              filteredPatients.map((patient) => (
                <div key={patient.id} className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border rounded-lg gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-sm md:text-base">{patient.nome}</p>
                    <p className="text-xs md:text-sm text-gray-500">
                      SUS/CPF: {patient.sus_cpf} | Idade: {patient.idade} anos
                    </p>
                    <p className="text-xs md:text-sm text-gray-500">
                      {patient.endereco}, {patient.bairro}
                    </p>
                    <p className="text-xs md:text-sm text-gray-500">Tel: {patient.telefone}</p>
                  </div>
                  <div className="flex gap-2 md:flex-col lg:flex-row">
                    <PermissionCheck 
                      permission="cadastro_pacientes"
                      fallback={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(patient)}
                          className="flex items-center gap-2 flex-1 md:flex-none h-10"
                        >
                          <Edit className="h-4 w-4" />
                          <span className="md:hidden lg:inline">Editar</span>
                        </Button>
                      }
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(patient)}
                        className="flex items-center gap-2 flex-1 md:flex-none h-10"
                      >
                        <Edit className="h-4 w-4" />
                        <span className="md:hidden lg:inline">Editar</span>
                      </Button>
                    </PermissionCheck>
                    
                    <PermissionCheck 
                      permission="cadastro_pacientes"
                      fallback={
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(patient.id, patient.nome)}
                          className="flex items-center gap-2 flex-1 md:flex-none h-10"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="md:hidden lg:inline">Excluir</span>
                        </Button>
                      }
                    >
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(patient.id, patient.nome)}
                        className="flex items-center gap-2 flex-1 md:flex-none h-10"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="md:hidden lg:inline">Excluir</span>
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
