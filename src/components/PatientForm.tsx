
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, Save, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Patient } from "@/types";

export function PatientForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
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
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error);
      toast({
        title: "Erro ao carregar pacientes",
        description: "Não foi possível carregar a lista de pacientes.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

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
      
      const { error } = await supabase
        .from('pacientes')
        .insert([{
          nome: formData.nome,
          sus_cpf: susCpfNumbers, // Salva apenas os números
          endereco: formData.endereco,
          bairro: formData.bairro,
          telefone: formData.telefone,
          nascimento: formData.nascimento,
          idade: idade
        }]);

      if (error) throw error;
      
      toast({
        title: "Paciente cadastrado com sucesso!",
        description: `${formData.nome} foi adicionado ao sistema.`,
      });
      
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
      toast({
        title: "Erro ao cadastrar paciente",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, nome: string) => {
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cadastro de Pacientes</h1>
          <p className="text-gray-600">Gerencie os dados dos pacientes da UBSF</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Novo Paciente
          </CardTitle>
          <CardDescription>
            Preencha todos os campos obrigatórios para cadastrar um novo paciente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  placeholder="Digite o nome completo"
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
                  required
                />
                {formData.sus_cpf && (
                  <p className="text-sm text-gray-500">
                    {formData.sus_cpf.length} dígitos inseridos
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço Completo *</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => handleInputChange('endereco', e.target.value)}
                  placeholder="Rua, número, complemento"
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
                  required
                />
                {idade > 0 && (
                  <p className="text-sm text-gray-500">Idade: {idade} anos</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => setFormData({
                nome: '', sus_cpf: '', endereco: '', bairro: '', telefone: '', nascimento: ''
              })}>
                Limpar
              </Button>
              <Button type="submit" disabled={loading} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {loading ? 'Salvando...' : 'Salvar Paciente'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de pacientes */}
      <Card>
        <CardHeader>
          <CardTitle>Pacientes Cadastrados ({patients.length})</CardTitle>
          <CardDescription>Lista dos pacientes no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {patients.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum paciente cadastrado.</p>
            ) : (
              patients.map((patient) => (
                <div key={patient.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{patient.nome}</p>
                    <p className="text-sm text-gray-500">
                      SUS/CPF: {patient.sus_cpf} | Idade: {patient.idade} anos
                    </p>
                    <p className="text-sm text-gray-500">
                      {patient.endereco}, {patient.bairro}
                    </p>
                    <p className="text-sm text-gray-500">Tel: {patient.telefone}</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(patient.id, patient.nome)}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
