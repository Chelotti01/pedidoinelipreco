'use server';

/**
 * @fileOverview This file implements a Genkit flow for intelligently processing XLSX price sheets.
 *
 * - intelligentlyProcessPriceSheet - A function that handles the parsing and extraction of product and discount information from an XLSX file.
 * - ProcessPriceSheetInput - The input type for the intelligentlyProcessPriceSheet function.
 * - ProcessPriceSheetOutput - The return type for the intelligentlyProcessPriceSheet function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as XLSX from 'xlsx';
import {Buffer} from 'buffer';

const ProcessPriceSheetInputSchema = z.object({
  xlsxDataUri: z
    .string()
    .describe(
      "The XLSX file content as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ProcessPriceSheetInput = z.infer<typeof ProcessPriceSheetInputSchema>;

const ProductSchema = z.object({
  name: z.string().describe('The name of the product.'),
  unit: z.string().describe('The unit of measurement for the product.'),
  closedLoadPrice: z.number().describe('The price for a closed load of the product.'),
  fractionalLoadPrice: z.number().describe('The price for a fractional load of the product.'),
});

const DiscountSchema = z.object({
  name: z.string().describe('The name or description of the discount.'),
  value: z.number().describe('The discount percentage or amount.'),
});

const FactorySheetOutputSchema = z.object({
  factoryName: z.string().describe('The name of the factory, derived from the sheet name.'),
  products: z.array(ProductSchema).describe('A list of products found in the sheet.'),
  discounts: z.array(DiscountSchema).describe('A list of discounts found in the sheet.'),
});

const ProcessPriceSheetOutputSchema = z
  .array(FactorySheetOutputSchema)
  .describe('An array containing processed data for each factory sheet in the XLSX file.');
export type ProcessPriceSheetOutput = z.infer<typeof ProcessPriceSheetOutputSchema>;

export async function intelligentlyProcessPriceSheet(
  input: ProcessPriceSheetInput
): Promise<ProcessPriceSheetOutput> {
  return intelligentlyProcessPriceSheetFlow(input);
}

const processSingleSheetPrompt = ai.definePrompt({
  name: 'processSingleSheetPrompt',
  input: {
    schema: z.object({
      sheetContent: z
        .string()
        .describe(
          'The content of a single XLSX sheet, represented as a JSON string of an array of arrays. Each inner array represents a row.'
        ),
      factoryName: z.string().describe('The name of the current factory/sheet.'),
    }),
  },
  output: {schema: FactorySheetOutputSchema},
  prompt: `You are an expert in parsing structured data from price sheets. Your task is to extract product and discount information from the provided sheet content, following specific rules.

Here are the parsing rules:

1.  **Product Information**: Locate the first occurrence of the term "Produto" (case-sensitive) in Column A. The row immediately below this term contains the product data. For each product:
    *   **Name**: Found in Column A.
    *   **Unit**: Found in Column B.
    *   **Closed Load Price**: Found in Column C. This should be a number.
    *   **Fractional Load Price**: Found in Column D. This should be a number.

2.  **Discount Information**: Further down the sheet, locate the second occurrence of the term "Produto" (case-sensitive) in Column A. The rows immediately below this second term contain discount data. For each discount:
    *   **Name**: Found in Column A.
    *   **Value**: Found in Column C. This should be a number.

Sheet Content for factory '{{{factoryName}}}' (JSON array of arrays, where each inner array is a row):
{{{sheetContent}}}

Extract the information into a JSON object with 'factoryName', 'products' (an array of product objects), and 'discounts' (an array of discount objects). If a price or discount value is not a valid number, omit it or set it to 0 if required by the schema. Only include products and discounts that you can fully parse according to the rules.`,
});

const intelligentlyProcessPriceSheetFlow = ai.defineFlow(
  {
    name: 'intelligentlyProcessPriceSheetFlow',
    inputSchema: ProcessPriceSheetInputSchema,
    outputSchema: ProcessPriceSheetOutputSchema,
  },
  async input => {
    const dataUriParts = input.xlsxDataUri.split(',');
    if (dataUriParts.length < 2) {
      throw new Error('Invalid data URI format.');
    }
    const base64Data = dataUriParts[1];
    const buffer = Buffer.from(base64Data, 'base64');

    const workbook = XLSX.read(buffer, {type: 'buffer'});

    const allFactoryData: ProcessPriceSheetOutput = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      // Convert sheet to an array of arrays (raw data)
      const sheetContentArray = XLSX.utils.sheet_to_json(worksheet, {header: 1, raw: false, defval: ''});

      // Pass the sheet content as a JSON string to the prompt
      const {output} = await processSingleSheetPrompt({
        sheetContent: JSON.stringify(sheetContentArray),
        factoryName: sheetName,
      });

      if (output) {
        allFactoryData.push(output);
      }
    }

    return allFactoryData;
  }
);
