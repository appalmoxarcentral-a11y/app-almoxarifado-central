
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
  const { user } = useAuth();
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

  const canImport = mode === 'entries' || (mode === 'products' && (user?.tipo === 'ADMIN' || user?.tipo === 'SUPER_ADMIN'));

  return (
    <Card className="border-border bg-card shadow-xl rounded-2xl md:rounded-3xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-primary/5 blur-3xl -mr-16 -mt-16 md:-mr-32 md:-mt-32" />
      
      <CardHeader className="p-5 md:p-8 relative">
        <CardTitle className="flex items-center gap-3 text-xl md:text-3xl font-black tracking-tighter">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
          </div>
          Importação/Exportação Excel
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 md:p-8 md:pt-0 relative">
        <div className="space-y-6">
          <div className="text-sm md:text-base font-medium text-muted-foreground leading-relaxed">
            {mode === 'products' 
              ? 'Use o modelo Excel para cadastrar novos produtos de forma massiva.'
              : 'Use o modelo Excel para registrar entradas de produtos em lote.'
            }
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Download do modelo */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">1. Baixar Modelo</h4>
              <Button 
                onClick={handleDownloadTemplate}
                variant="outline" 
                className="w-full h-12 md:h-14 flex items-center justify-center gap-3 rounded-xl font-bold border-border hover:bg-muted transition-all"
                disabled={isLoadingTemplate}
              >
                <Download className="h-5 w-5" />
                {isLoadingTemplate ? 'Preparando...' : 'Baixar Modelo Excel'}
              </Button>
            </div>

            {/* Upload do arquivo */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">2. Importar Dados</h4>
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    disabled={!canImport}
                    className="h-12 md:h-14 pt-2.5 pl-4 rounded-xl cursor-pointer bg-muted/30 border-dashed border-2 hover:bg-muted/50 transition-all text-xs"
                  />
                </div>
                {!canImport && (
                  <p className="text-xs font-bold text-destructive flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Apenas administradores podem importar produtos.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/10 p-5 rounded-2xl space-y-3 shadow-inner">
            <h4 className="font-black text-primary text-xs uppercase tracking-widest flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Instruções de Uso
            </h4>
            <ul className="text-xs md:text-sm text-muted-foreground space-y-2 font-medium">
              <li className="flex items-start gap-2">• <span>O modelo virá preenchido com dados existentes para sua referência.</span></li>
              <li className="flex items-start gap-2">• <span>{mode === 'products' ? 'Adicione novos produtos nas linhas vazias seguindo o padrão.' : 'Preencha quantidade, lote e vencimento para registrar entradas.'}</span></li>
              <li className="flex items-start gap-2">• <span>Campos obrigatórios: <strong>Código, Descrição e Unidade de Medida</strong>.</span></li>
              <li className="flex items-start gap-2">• <span>Mantenha o formato original do modelo para evitar falhas no processamento.</span></li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
