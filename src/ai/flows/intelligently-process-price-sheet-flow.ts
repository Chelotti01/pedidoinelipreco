'use server';

/**
 * @fileOverview Este arquivo implementa o processamento local de planilhas XLSX.
 * 
 * - intelligentlyProcessPriceSheet - Função principal que analisa o arquivo XLSX sem usar IA.
 */

import * as XLSX from 'xlsx';
import { Buffer } from 'buffer';

export interface Product {
  name: string;
  unit: string;
  closedLoadPrice: number;
  fractionalLoadPrice: number;
  discountAmount?: number;
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
 * Implementa deduplicação para garantir que o mesmo produto não apareça duas vezes na mesma fábrica.
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
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    let firstProdutoIndex = -1;
    let secondProdutoIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const colAValue = String(rows[i][0] || '').trim().toLowerCase();
      if (colAValue === "produto") {
        if (firstProdutoIndex === -1) {
          firstProdutoIndex = i;
        } else {
          secondProdutoIndex = i;
          break;
        }
      }
    }

    // Usamos um Map para evitar duplicatas na mesma aba (chave: nome|unidade)
    const productsMap = new Map<string, Product>();
    const rawDiscounts: Discount[] = [];

    // Extração de Produtos
    if (firstProdutoIndex !== -1) {
      const startRow = firstProdutoIndex + 1;
      const endRow = secondProdutoIndex !== -1 ? secondProdutoIndex : rows.length;
      
      for (let i = startRow; i < endRow; i++) {
        const row = rows[i];
        const name = String(row[0] || '').trim();
        const unit = String(row[1] || '').trim();
        if (!name) continue;

        const key = `${name.toLowerCase()}|${unit.toLowerCase()}`;
        productsMap.set(key, {
          name,
          unit,
          closedLoadPrice: parsePrice(row[2]),
          fractionalLoadPrice: parsePrice(row[3]),
        });
      }
    }

    // Extração de Descontos
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
          value: parsePrice(row[2]),
        });
      }
    }

    // Vincular descontos
    const finalProducts = Array.from(productsMap.values()).map(product => {
      const match = rawDiscounts.find(d => 
        d.name.toLowerCase() === product.name.toLowerCase() && 
        d.unit.toLowerCase() === product.unit.toLowerCase()
      );
      return {
        ...product,
        discountAmount: match ? match.value : 0
      };
    });

    allFactoryData.push({
      factoryName: sheetName.trim(),
      products: finalProducts,
      discounts: rawDiscounts,
    });
  }

  return allFactoryData;
}

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

export interface ProcessPriceSheetInput {
  xlsxDataUri: string;
}
