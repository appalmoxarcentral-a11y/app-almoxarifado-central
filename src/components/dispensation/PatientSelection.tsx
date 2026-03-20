
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { SmartDatePicker } from '@/components/ui/smart-date-picker';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { Patient } from '@/types';

interface PatientSelectionProps {
  selectedPatient: string;
  setSelectedPatient: (value: string) => void;
  dataDispensa: string;
  setDataDispensa: (value: string) => void;
  tipoDispensacao: string;
  setTipoDispensacao: (value: string) => void;
  pacientes?: Patient[];
  procedimentos?: any[];
  onSearchChange?: (value: string) => void;
  onProcedureSearchChange?: (value: string) => void;
}

export function PatientSelection({
  selectedPatient,
  setSelectedPatient,
  dataDispensa,
  setDataDispensa,
  tipoDispensacao,
  setTipoDispensacao,
  pacientes = [],
  procedimentos = [],
  onSearchChange,
  onProcedureSearchChange
}: PatientSelectionProps) {
  const { user } = useAuth();
  const pacienteSelecionado = pacientes.find(p => p.id === selectedPatient);

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient.id);
  };

  const handleProcedureSelect = (procedimento: any) => {
    setTipoDispensacao(procedimento.nome);
  };

  return (
    <Card className="lg:col-span-2 border-border bg-card shadow-xl rounded-2xl md:rounded-3xl overflow-hidden relative">
      <CardHeader className="p-5 md:p-8 relative">
        <CardTitle className="flex items-center gap-3 text-xl md:text-2xl font-black tracking-tighter">
          <div className="p-2 bg-primary/10 rounded-lg">
            <User className="h-5 w-5 text-primary" />
          </div>
          1. Selecionar Paciente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 md:p-8 md:pt-0 relative space-y-6">
        <div className="space-y-2">
          <Label htmlFor="paciente" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Paciente *</Label>
          <SearchableSelect
            items={pacientes}
            value={selectedPatient}
            onSelect={handlePatientSelect}
            onSearchChange={onSearchChange}
            getItemValue={(patient) => patient.id}
            getItemLabel={(patient) => `${patient.nome} - ${patient.sus_cpf}`}
            getItemSearchText={(patient) => `${patient.nome} ${patient.sus_cpf}`}
            placeholder="Selecione um paciente"
            searchPlaceholder="Digite nome ou SUS/CPF do paciente..."
            emptyMessage="Nenhum paciente encontrado"
            className="h-12 text-[16px] rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {(user?.usar_tipo_dispensacao || user?.permissoes?.usar_tipo_dispensacao) && (
          <div className="space-y-2">
            <Label htmlFor="tipoDispensacao" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5" />
              Tipo Dispensação *
            </Label>
            <div className="relative">
              <SearchableSelect
                items={procedimentos}
                value={tipoDispensacao}
                onSelect={handleProcedureSelect}
                onSearchChange={(val) => {
                  setTipoDispensacao(val);
                  if (onProcedureSearchChange) onProcedureSearchChange(val);
                }}
                getItemValue={(proc) => proc.id}
                getItemLabel={(proc) => proc.nome}
                getItemSearchText={(proc) => proc.nome}
                placeholder="Selecione ou digite um procedimento"
                searchPlaceholder="Busque ou digite o procedimento..."
                emptyMessage="Pressione Enter para usar este nome"
                className="h-12 text-[16px] rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20"
              />
              {tipoDispensacao && !procedimentos.find(p => p.nome === tipoDispensacao) && (
                <div className="absolute right-12 top-1/2 -translate-y-1/2">
                  <span className="text-[10px] font-bold text-primary uppercase bg-primary/10 px-2 py-1 rounded-full">Novo</span>
                </div>
              )}
            </div>
          </div>
        )}

        {pacienteSelecionado && (
          <div className="bg-primary/10 p-4 rounded-xl border border-primary/20 shadow-sm transition-all animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-2 text-primary">
              <User className="h-5 w-5" />
              <span className="font-semibold">Paciente Selecionado</span>
            </div>
            <p className="text-foreground/90 mt-1 font-medium text-lg">
              {pacienteSelecionado.nome}
            </p>
            <p className="text-muted-foreground text-sm">
              SUS/CPF: {pacienteSelecionado.sus_cpf}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="dataDispensa" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5" />
            Data da Dispensação
          </Label>
          <SmartDatePicker
            id="dataDispensa"
            value={dataDispensa}
            onChange={setDataDispensa}
            className="w-full"
          />
        </div>
      </CardContent>
    </Card>
  );
}
