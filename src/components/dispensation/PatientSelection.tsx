
import React from 'react';
import { User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
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
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          1. Selecionar Paciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          <Label htmlFor="paciente">Paciente *</Label>
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
          />
        </div>

        {pacienteSelecionado && (
          <div className="mt-3 bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <User className="h-4 w-4" />
              <span className="font-medium">Paciente Selecionado</span>
            </div>
            <p className="text-blue-600 mt-1">
              {pacienteSelecionado.nome} - {pacienteSelecionado.sus_cpf}
            </p>
          </div>
        )}

        <div className="mt-4">
          <Label htmlFor="dataDispensa">Data da Dispensação</Label>
          <Input
            id="dataDispensa"
            type="date"
            value={dataDispensa}
            onChange={(e) => setDataDispensa(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
