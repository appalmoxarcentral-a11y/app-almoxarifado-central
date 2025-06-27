
import React from 'react';
import { User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  pacientes
}: PatientSelectionProps) {
  const pacienteSelecionado = pacientes?.find(p => p.id === selectedPatient);

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
          <Select value={selectedPatient} onValueChange={setSelectedPatient}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um paciente" />
            </SelectTrigger>
            <SelectContent>
              {pacientes?.map((paciente) => (
                <SelectItem key={paciente.id} value={paciente.id}>
                  {paciente.nome} - {paciente.sus_cpf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
