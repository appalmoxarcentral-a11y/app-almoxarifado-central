
import React from 'react';
import { User } from 'lucide-react';
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
  pacientes?: Patient[];
}

export function PatientSelection({
  selectedPatient,
  setSelectedPatient,
  dataDispensa,
  setDataDispensa,
  pacientes = []
}: PatientSelectionProps) {
  const pacienteSelecionado = pacientes.find(p => p.id === selectedPatient);

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient.id);
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
            getItemValue={(patient) => patient.id}
            getItemLabel={(patient) => `${patient.nome} - ${patient.sus_cpf}`}
            getItemSearchText={(patient) => `${patient.nome} ${patient.sus_cpf}`}
            placeholder="Selecione um paciente"
            searchPlaceholder="Digite nome ou SUS/CPF do paciente..."
            emptyMessage="Nenhum paciente encontrado"
            className="h-12 text-[16px] rounded-xl border-border bg-background focus:ring-2 focus:ring-primary/20"
          />
        </div>

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
