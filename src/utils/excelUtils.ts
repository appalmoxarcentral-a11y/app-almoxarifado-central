
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Product, ProductEntry } from '@/types';

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

// Função para converter números seriais do Excel para datas
const convertExcelDate = (value: any): string | undefined => {
  if (!value) return undefined;
  
  // Se já é uma string de data válida no formato YYYY-MM-DD, retornar
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  
  // Se é número (serial do Excel)
  if (typeof value === 'number' || (!isNaN(Number(value)) && Number(value) > 1)) {
    const serial = Number(value);
    // Excel epoch: 1 = 1900-01-01, mas Excel trata 1900 como ano bissexto erroneamente
    const excelEpoch = new Date(1899, 11, 30); // 30 de dezembro de 1899
    const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
    
    // Verificar se a data é válida
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Tentar parsing direto como string
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  return undefined;
};

export const downloadProductsTemplate = (existingProducts: Product[] = []) => {
  let template;
  
  if (existingProducts.length > 0) {
    // Preencher com produtos existentes para facilitar adição de novos
    template = existingProducts.map(product => ({
      'Código': product.codigo,
      'Descrição': product.descricao,
      'Unidade de Medida': product.unidade_medida,
      'Quantidade': '',
      'Lote': '',
      'Vencimento': '',
      'Data Entrada': ''
    }));
    
    // Adicionar algumas linhas vazias para novos produtos
    for (let i = 0; i < 5; i++) {
      template.push({
        'Código': '',
        'Descrição': '',
        'Unidade de Medida': '',
        'Quantidade': '',
        'Lote': '',
        'Vencimento': '',
        'Data Entrada': ''
      });
    }
  } else {
    // Template padrão quando não há produtos
    template = [
      {
        'Código': 'DIP500',
        'Descrição': 'Dipirona 500mg',
        'Unidade de Medida': 'CP',
        'Quantidade': '',
        'Lote': '',
        'Vencimento': '',
        'Data Entrada': ''
      },
      {
        'Código': '',
        'Descrição': '',
        'Unidade de Medida': '',
        'Quantidade': '',
        'Lote': '',
        'Vencimento': '',
        'Data Entrada': ''
      }
    ];
  }

  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos');

  worksheet['!cols'] = [
    { width: 15 }, { width: 30 }, { width: 20 }, { width: 15 }, 
    { width: 15 }, { width: 15 }, { width: 15 }
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(data, 'produtos_cadastrados.xlsx');
};

export const downloadEntriesTemplate = (existingProducts: Product[] = []) => {
  let template;
  
  if (existingProducts.length > 0) {
    // Preencher com produtos existentes para facilitar entradas
    template = existingProducts.map(product => ({
      'Código': product.codigo,
      'Descrição': product.descricao,
      'Unidade de Medida': product.unidade_medida,
      'Quantidade': '',
      'Lote': '',
      'Vencimento': '',
      'Data Entrada': ''
    }));
  } else {
    // Template padrão quando não há produtos
    template = [
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
        'Código': '',
        'Descrição': '',
        'Unidade de Medida': '',
        'Quantidade': '',
        'Lote': '',
        'Vencimento': '',
        'Data Entrada': ''
      }
    ];
  }

  const worksheet = XLSX.utils.json_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Entradas');

  worksheet['!cols'] = [
    { width: 15 }, { width: 30 }, { width: 20 }, { width: 15 }, 
    { width: 15 }, { width: 15 }, { width: 15 }
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(data, 'modelo_entradas.xlsx');
};

// Manter função original para compatibilidade
export const downloadExcelTemplate = () => {
  downloadProductsTemplate();
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
          vencimento: convertExcelDate(row['Vencimento']),
          data_entrada: convertExcelDate(row['Data Entrada']),
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
    const lineNumber = index + 2;
    
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
