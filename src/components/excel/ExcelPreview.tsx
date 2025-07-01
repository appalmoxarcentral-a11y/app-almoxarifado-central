
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExcelProductRow } from '@/utils/excelUtils';
import { CheckCircle, XCircle, Package, ArrowRight } from 'lucide-react';

interface ExcelPreviewProps {
  data: ExcelProductRow[];
  errors: string[];
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
  mode: 'products' | 'entries';
}

export function ExcelPreview({ data, errors, onConfirm, onCancel, isProcessing, mode }: ExcelPreviewProps) {
  const hasEntries = data.some(row => row.quantidade && row.quantidade > 0);
  const hasOnlyProducts = data.some(row => !row.quantidade || row.quantidade <= 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Preview dos Dados - {data.length} item(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Resumo do que será processado */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Resumo do Processamento:</h4>
              <div className="space-y-1 text-sm text-blue-800">
                {mode === 'products' && (
                  <>
                    {hasOnlyProducts && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>Produtos serão cadastrados/atualizados</span>
                      </div>
                    )}
                    {hasEntries && (
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4" />
                        <span>Entradas de estoque serão registradas automaticamente</span>
                      </div>
                    )}
                  </>
                )}
                {mode === 'entries' && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Entradas de estoque serão registradas</span>
                  </div>
                )}
              </div>
            </div>

            {/* Lista de erros */}
            {errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-medium text-red-900 mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Erros Encontrados ({errors.length}):
                </h4>
                <div className="space-y-1 text-sm text-red-800 max-h-32 overflow-y-auto">
                  {errors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview dos dados */}
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-left">Unidade</th>
                    <th className="p-2 text-left">Quantidade</th>
                    <th className="p-2 text-left">Lote</th>
                    <th className="p-2 text-left">Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 10).map((row, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2 font-mono">{row.codigo}</td>
                      <td className="p-2">{row.descricao}</td>
                      <td className="p-2">
                        <Badge variant="outline">{row.unidade_medida}</Badge>
                      </td>
                      <td className="p-2">{row.quantidade || '-'}</td>
                      <td className="p-2">{row.lote || '-'}</td>
                      <td className="p-2">{row.vencimento || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 10 && (
                <div className="p-2 text-center text-gray-500 text-sm border-t">
                  ... e mais {data.length - 10} item(s)
                </div>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button 
                onClick={onConfirm} 
                disabled={errors.length > 0 || isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? 'Processando...' : 'Confirmar Importação'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
