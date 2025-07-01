
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface ExcelProductRow {
  codigo: string;
  descricao: string;
  unidade_medida: string;
  quantidade?: number;
  lote?: string;
  vencimento?: string;
  data_entrada?: string;
}

export interface ProcessResult {
  success: boolean;
  errors: string[];
  processedCount: number;
  totalCount: number;
}

export const downloadExcelTemplate = () => {
  const template = [
    {
      'Código': 'DIP500',
      'Descrição': 'Dipirona 500mg',
      'Unidade de Medida': 'CP',
      'Quantidade': '100',
      'Lote': 'L001',
      'Vencimento': '2025-12-31',
      'Data Entrada': '2024-07-01'
    },
    {
      'Código': 'PAR750',
      'Descrição': 'Paracetamol 750mg',
      'Unidade de Medida': 'CP',
      'Quantidade': '',
      'Lote': '',
      'Vencimento': '',
      'Data Entrada': ''
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Modelo');

  // Configurar largura das colunas
  worksheet['!cols'] = [
    { width: 15 }, // Código
    { width: 30 }, // Descrição
    { width: 20 }, // Unidade de Medida
    { width: 15 }, // Quantidade
    { width: 15 }, // Lote
    { width: 15 }, // Vencimento
    { width: 15 }  // Data Entrada
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(data, 'modelo_produtos.xlsx');
};

export const readExcelFile = (file: File): Promise<ExcelProductRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const products: ExcelProductRow[] = jsonData.map((row: any) => ({
          codigo: String(row['Código'] || '').trim().toUpperCase(),
          descricao: String(row['Descrição'] || '').trim(),
          unidade_medida: String(row['Unidade de Medida'] || '').trim().toUpperCase(),
          quantidade: row['Quantidade'] ? Number(row['Quantidade']) : undefined,
          lote: row['Lote'] ? String(row['Lote']).trim() : undefined,
          vencimento: row['Vencimento'] ? String(row['Vencimento']).trim() : undefined,
          data_entrada: row['Data Entrada'] ? String(row['Data Entrada']).trim() : undefined,
        }));

        resolve(products.filter(p => p.codigo && p.descricao));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const validateExcelData = (data: ExcelProductRow[], availableUnits: string[]): string[] => {
  const errors: string[] = [];
  
  data.forEach((row, index) => {
    const lineNumber = index + 2; // +2 porque Excel começa em 1 e tem header
    
    if (!row.codigo) {
      errors.push(`Linha ${lineNumber}: Código é obrigatório`);
    }
    
    if (!row.descricao) {
      errors.push(`Linha ${lineNumber}: Descrição é obrigatória`);
    }
    
    if (!row.unidade_medida) {
      errors.push(`Linha ${lineNumber}: Unidade de medida é obrigatória`);
    } else if (!availableUnits.includes(row.unidade_medida)) {
      errors.push(`Linha ${lineNumber}: Unidade de medida "${row.unidade_medida}" não é válida`);
    }
    
    if (row.quantidade !== undefined) {
      if (row.quantidade <= 0) {
        errors.push(`Linha ${lineNumber}: Quantidade deve ser maior que zero`);
      }
      
      if (!row.lote) {
        errors.push(`Linha ${lineNumber}: Lote é obrigatório quando quantidade é informada`);
      }
      
      if (!row.vencimento) {
        errors.push(`Linha ${lineNumber}: Vencimento é obrigatório quando quantidade é informada`);
      } else {
        const vencimentoDate = new Date(row.vencimento);
        if (isNaN(vencimentoDate.getTime()) || vencimentoDate <= new Date()) {
          errors.push(`Linha ${lineNumber}: Data de vencimento deve ser uma data futura válida`);
        }
      }
    }
  });
  
  return errors;
};
