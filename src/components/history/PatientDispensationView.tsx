
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Package, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Dispensation } from '@/types';

interface PatientDispensationViewProps {
  searchTerm: string;
}

interface PatientWithDispensations {
  id: string;
  nome: string;
  sus_cpf: string;
  endereco: string;
  bairro: string;
  telefone: string;
  nascimento: string;
  idade: number;
  dispensacoes: Dispensation[];
  total_produtos_diferentes: number;
  total_quantidade_dispensada: number;
}

export function PatientDispensationView({ searchTerm }: PatientDispensationViewProps) {
  const { data: pacientesComDispensacoes, isLoading } = useQuery({
    queryKey: ['pacientes-com-dispensacoes', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('dispensacoes')
        .select(`
          *,
          paciente:paciente_id (
            id,
            nome,
            sus_cpf,
            endereco,
            bairro,
            telefone,
            nascimento,
            idade
          ),
          produto:produto_id (
            descricao,
            codigo,
            unidade_medida
          )
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por paciente
      const pacientesMap = new Map<string, PatientWithDispensations>();
      
      data?.forEach((dispensacao) => {
        if (!dispensacao.paciente) return;
        
        const pacienteId = dispensacao.paciente.id;
        const paciente = dispensacao.paciente;
        
        // Filtrar por busca se especificado
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const matchesName = paciente.nome.toLowerCase().includes(searchLower);
          const matchesSusCpf = paciente.sus_cpf.toLowerCase().includes(searchLower);
          
          if (!matchesName && !matchesSusCpf) return;
        }
        
        if (!pacientesMap.has(pacienteId)) {
          pacientesMap.set(pacienteId, {
            id: paciente.id,
            nome: paciente.nome,
            sus_cpf: paciente.sus_cpf,
            endereco: paciente.endereco,
            bairro: paciente.bairro,
            telefone: paciente.telefone,
            nascimento: paciente.nascimento,
            idade: paciente.idade,
            dispensacoes: [],
            total_produtos_diferentes: 0,
            total_quantidade_dispensada: 0
          });
        }
        
        const pacienteData = pacientesMap.get(pacienteId)!;
        pacienteData.dispensacoes.push(dispensacao as Dispensation);
      });
      
      // Calcular totais para cada paciente
      pacientesMap.forEach((paciente) => {
        const produtosUnicos = new Set();
        let totalQuantidade = 0;
        
        paciente.dispensacoes.forEach((dispensacao) => {
          produtosUnicos.add(dispensacao.produto_id);
          totalQuantidade += dispensacao.quantidade;
        });
        
        paciente.total_produtos_diferentes = produtosUnicos.size;
        paciente.total_quantidade_dispensada = totalQuantidade;
      });
      
      return Array.from(pacientesMap.values());
    },
  });

  if (isLoading) {
    return <div className="text-center py-4">Carregando dispensações por paciente...</div>;
  }

  if (!pacientesComDispensacoes?.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        {searchTerm ? 'Nenhum paciente encontrado com o termo buscado' : 'Nenhuma dispensação encontrada'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pacientesComDispensacoes.map((paciente) => (
        <Card key={paciente.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-lg font-semibold">{paciente.nome}</div>
                <div className="text-sm text-gray-600">SUS/CPF: {paciente.sus_cpf}</div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Resumo do paciente */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-xs text-gray-600">Produtos Diferentes</p>
                  <p className="font-semibold">{paciente.total_produtos_diferentes}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-600">Total Dispensações</p>
                  <p className="font-semibold">{paciente.dispensacoes.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-600">Quantidade Total</p>
                  <p className="font-semibold">{paciente.total_quantidade_dispensada}</p>
                </div>
              </div>
            </div>

            {/* Tabela de dispensações */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[100px]">Data</TableHead>
                    <TableHead className="min-w-[150px]">Produto</TableHead>
                    <TableHead className="min-w-[80px]">Qtd</TableHead>
                    <TableHead className="min-w-[100px]">Lote</TableHead>
                    <TableHead className="min-w-[100px]">Unidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paciente.dispensacoes.map((dispensacao) => (
                    <TableRow key={dispensacao.id}>
                      <TableCell className="text-xs md:text-sm">
                        {format(new Date(dispensacao.data_dispensa), 'dd/MM/yy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm max-w-[150px] truncate">
                        {dispensacao.produto?.descricao}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm font-semibold">
                        {dispensacao.quantidade}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        {dispensacao.lote}
                      </TableCell>
                      <TableCell className="text-xs md:text-sm">
                        <Badge variant="outline" className="text-xs">
                          {dispensacao.produto?.unidade_medida}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
