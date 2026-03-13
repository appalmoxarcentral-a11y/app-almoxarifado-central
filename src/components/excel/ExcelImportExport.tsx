
import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { downloadProductsTemplate, downloadEntriesTemplate, readExcelFile, validateExcelData, ExcelProductRow } from '@/utils/excelUtils';
import { useExcelProcessor } from '@/hooks/useExcelProcessor';
import { ExcelPreview } from './ExcelPreview';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Product } from '@/types';

interface ExcelImportExportProps {
  mode: 'products' | 'entries';
  onSuccess?: () => void;
}

export function ExcelImportExport({ mode, onSuccess }: ExcelImportExportProps) {
  const [excelData, setExcelData] = useState<ExcelProductRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const { user, isImpersonating } = useAuth();
  const { processProductsFromExcel, processEntriesFromExcel, isProcessing } = useExcelProcessor();

  React.useEffect(() => {
    loadAvailableUnits();
  }, []);

  const loadAvailableUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('unidades_medida')
        .select('codigo')
        .eq('ativo', true)
        .order('codigo');

      if (error) throw error;
      setAvailableUnits(data.map(unit => unit.codigo));
    } catch (error) {
      console.error('Erro ao carregar unidades:', error);
    }
  };

  const loadExistingProducts = async (): Promise<Product[]> => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('descricao');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      return [];
    }
  };

  const handleDownloadTemplate = async () => {
    setIsLoadingTemplate(true);
    try {
      const existingProducts = await loadExistingProducts();
      
      if (mode === 'products') {
        downloadProductsTemplate(existingProducts);
        toast({
          title: "Modelo baixado com sucesso!",
          description: `O arquivo produtos_cadastrados.xlsx foi baixado com ${existingProducts.length} produtos existentes.`,
        });
      } else {
        downloadEntriesTemplate(existingProducts);
        toast({
          title: "Modelo baixado com sucesso!",
          description: `O arquivo modelo_entradas.xlsx foi baixado com ${existingProducts.length} produtos disponíveis.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao baixar modelo",
        description: "Não foi possível carregar os dados existentes.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTemplate(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await readExcelFile(file);
      const errors = validateExcelData(data, availableUnits);
      
      setExcelData(data);
      setValidationErrors(errors);
      setShowPreview(true);
    } catch (error) {
      toast({
        title: "Erro ao ler arquivo",
        description: "Não foi possível processar o arquivo Excel. Verifique se o formato está correto.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmImport = async () => {
    try {
      let result;
      
      if (mode === 'products') {
        result = await processProductsFromExcel(excelData);
      } else {
        result = await processEntriesFromExcel(excelData);
      }

      if (result.success) {
        toast({
          title: "Importação concluída com sucesso!",
          description: `${result.processedCount} de ${result.totalCount} item(s) processado(s).`,
        });
      } else {
        toast({
          title: "Importação concluída com erros",
          description: `${result.processedCount} de ${result.totalCount} item(s) processado(s). ${result.errors.length} erro(s) encontrado(s).`,
          variant: "destructive",
        });
        console.log('Erros de processamento:', result.errors);
      }

      setShowPreview(false);
      setExcelData([]);
      setValidationErrors([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleCancelImport = () => {
    setShowPreview(false);
    setExcelData([]);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (showPreview) {
    return (
      <ExcelPreview
        data={excelData}
        errors={validationErrors}
        onConfirm={handleConfirmImport}
        onCancel={handleCancelImport}
        isProcessing={isProcessing}
        mode={mode}
      />
    );
  }

  const canImport = mode === 'entries' || (mode === 'products' && (user?.tipo === 'ADMIN' || user?.tipo === 'SUPER_ADMIN' || isImpersonating));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importação/Exportação Excel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            {mode === 'products' 
              ? 'Use o modelo Excel para cadastrar novos produtos. O modelo virá preenchido com produtos já cadastrados.'
              : 'Use o modelo Excel para registrar entradas de produtos. O modelo virá preenchido com todos os produtos disponíveis.'
            }
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Download do modelo */}
            <div className="space-y-2">
              <h4 className="font-medium">1. Baixar Modelo</h4>
              <Button 
                onClick={handleDownloadTemplate}
                variant="outline" 
                className="w-full flex items-center gap-2"
                disabled={isLoadingTemplate}
              >
                <Download className="h-4 w-4" />
                {isLoadingTemplate ? 'Preparando...' : 'Baixar Modelo Excel'}
              </Button>
            </div>

            {/* Upload do arquivo */}
            <div className="space-y-2">
              <h4 className="font-medium">2. Importar Dados</h4>
              <div className="space-y-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  disabled={!canImport}
                />
                {!canImport && (
                  <p className="text-xs text-orange-600">
                    Apenas administradores podem importar produtos.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Instruções:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• O modelo virá preenchido com dados existentes</li>
              <li>• {mode === 'products' ? 'Adicione novos produtos nas linhas vazias' : 'Preencha quantidade, lote e vencimento para registrar entradas'}</li>
              <li>• Campos obrigatórios: Código, Descrição, Unidade de Medida</li>
              <li>• Para registrar entradas: preencha Quantidade, Lote e Vencimento</li>
              <li>• Mantenha o formato do modelo para evitar erros</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
