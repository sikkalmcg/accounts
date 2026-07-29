'use server';
/**
 * @fileOverview A Genkit flow for extracting key details from a purchase invoice document.
 *
 * - extractPurchaseInvoiceDetails - A function that handles the invoice details extraction process.
 * - ExtractPurchaseInvoiceDetailsInput - The input type for the extractPurchaseInvoiceDetails function.
 * - ExtractPurchaseInvoiceDetailsOutput - The return type for the extractPurchaseInvoiceDetails function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractPurchaseInvoiceDetailsInputSchema = z.object({
  invoiceDocumentDataUri: z
    .string()
    .describe(
      "A purchase invoice document (PDF or image), as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractPurchaseInvoiceDetailsInput = z.infer<typeof ExtractPurchaseInvoiceDetailsInputSchema>;

const ExtractPurchaseInvoiceDetailsOutputSchema = z.object({
  invoiceNumber: z.string().describe('The invoice number extracted from the document.'),
  totalAmount: z
    .number()
    .describe('The total amount of the invoice, extracted as a number.'),
  vendor: z.string().describe('The name of the vendor (seller) on the invoice.'),
  invoiceDate: z
    .string()
    .optional()
    .describe('The date of the invoice in YYYY-MM-DD format, if available.'),
});
export type ExtractPurchaseInvoiceDetailsOutput = z.infer<typeof ExtractPurchaseInvoiceDetailsOutputSchema>;

export async function extractPurchaseInvoiceDetails(
  input: ExtractPurchaseInvoiceDetailsInput
): Promise<ExtractPurchaseInvoiceDetailsOutput> {
  return extractPurchaseInvoiceDetailsFlow(input);
}

const extractPurchaseInvoiceDetailsPrompt = ai.definePrompt({
  name: 'extractPurchaseInvoiceDetailsPrompt',
  input: { schema: ExtractPurchaseInvoiceDetailsInputSchema },
  output: { schema: ExtractPurchaseInvoiceDetailsOutputSchema },
  prompt: `You are an expert at extracting key information from purchase invoice documents.

Carefully analyze the provided invoice document and extract the following details:
- Invoice Number
- Total Amount
- Vendor Name
- Invoice Date (if available, in YYYY-MM-DD format)

Present the extracted information in a JSON object matching the provided schema. Ensure the total amount is parsed as a number.

Invoice Document: {{media url=invoiceDocumentDataUri}}`,
});

const extractPurchaseInvoiceDetailsFlow = ai.defineFlow(
  {
    name: 'extractPurchaseInvoiceDetailsFlow',
    inputSchema: ExtractPurchaseInvoiceDetailsInputSchema,
    outputSchema: ExtractPurchaseInvoiceDetailsOutputSchema,
  },
  async (input) => {
    const { output } = await extractPurchaseInvoiceDetailsPrompt(input);
    return output!;
  }
);


