'use server';

/**
 * @fileOverview Este arquivo implementa o processamento local de planilhas XLSX.
 * 
 * - intelligentlyProcessPriceSheet - Função principal que analisa o arquivo XLSX sem usar IA.
 */

import * as XLSX from 'xlsx';
import { Buffer } from 'buffer';

export interface ProcessPriceSheetInput {
  xlsxDataUri: string;
}

export interface Product {
  name: string;
  unit: string;
  closedLoadPrice: number;
  fractionalLoadPrice: number;
  discountAmount?: number; // Adicionado para armazenar o desconto em R$
}

export interface Discount {
  name: string;
  unit: string;
  value: number;
}

export interface FactorySheetOutput {
  factoryName: string;
  products: Product[];
  discounts: Discount[];
}

export type ProcessPriceSheetOutput = FactorySheetOutput[];

/**
 * Processa a planilha XLSX localmente, identificando produtos e descontos.
 */
export async function intelligentlyProcessPriceSheet(
  input: ProcessPriceSheetInput
): Promise<ProcessPriceSheetOutput> {
  const dataUriParts = input.xlsxDataUri.split(',');
  if (dataUriParts.length < 2) {
    throw new Error('Formato de URI de dados inválido.');
  }
  const base64Data = dataUriParts[1];
  const buffer = Buffer.from(base64Data, 'base64');

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const allFactoryData: ProcessPriceSheetOutput = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    // Converte a aba em uma matriz de matrizes (linhas e colunas)
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    let firstProdutoIndex = -1;
    let secondProdutoIndex = -1;

    // Localiza os marcadores "Produto" na Coluna A
    for (let i = 0; i < rows.length; i++) {
      const colAValue = String(rows[i][0] || '').trim();
      if (colAValue === "Produto") {
        if (firstProdutoIndex === -1) {
          firstProdutoIndex = i;
        } else {
          secondProdutoIndex = i;
          break;
        }
      }
    }

    const products: Product[] = [];
    const rawDiscounts: Discount[] = [];

    // Extração de Produtos (abaixo do primeiro "Produto")
    if (firstProdutoIndex !== -1) {
      const startRow = firstProdutoIndex + 1;
      const endRow = secondProdutoIndex !== -1 ? secondProdutoIndex : rows.length;
      
      for (let i = startRow; i < endRow; i++) {
        const row = rows[i];
        const name = String(row[0] || '').trim();
        if (!name) continue;

        products.push({
          name,
          unit: String(row[1] || '').trim(),
          closedLoadPrice: parsePrice(row[2]),
          fractionalLoadPrice: parsePrice(row[3]),
        });
      }
    }

    // Extração de Descontos (abaixo do segundo "Produto")
    if (secondProdutoIndex !== -1) {
      const startRow = secondProdutoIndex + 1;
      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row[0] || '').trim();
        const unit = String(row[1] || '').trim();
        if (!name) continue;

        rawDiscounts.push({
          name,
          unit,
          value: parsePrice(row[2]), // Valor do desconto em R$ na coluna C
        });
      }
    }

    // Vincular descontos aos produtos com base em Nome e Unidade idênticos
    const finalProducts = products.map(product => {
      const match = rawDiscounts.find(d => 
        d.name === product.name && 
        d.unit === product.unit
      );
      return {
        ...product,
        discountAmount: match ? match.value : 0
      };
    });

    allFactoryData.push({
      factoryName: sheetName,
      products: finalProducts,
      discounts: rawDiscounts, // Mantemos aqui para compatibilidade
    });
  }

  return allFactoryData;
}

/**
 * Auxiliar para converter valores da planilha em números.
 */
function parsePrice(value: any): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const cleaned = String(value)
    .replace('R$', '')
    .replace('%', '')
    .replace(/\s/g, '')
    .replace('.', '')
    .replace(',', '.');
    
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
