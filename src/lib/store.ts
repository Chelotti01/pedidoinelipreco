"use client"

import { ProcessPriceSheetOutput } from "@/ai/flows/intelligently-process-price-sheet-flow";

export type OrderItem = {
  productId: string;
  factoryName: string;
  name: string;
  unit: string;
  quantity: number;
  priceType: 'closed' | 'fractional';
  unitPrice: number;
  appliedDiscount: number;
  total: number;
};

export function getStoredData(): ProcessPriceSheetOutput {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem('inteli_preco_data');
  return data ? JSON.parse(data) : [];
}

export function saveStoredData(data: ProcessPriceSheetOutput) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('inteli_preco_data', JSON.stringify(data));
}

export function clearStoredData() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('inteli_preco_data');
}