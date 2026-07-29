'use server';
/**
 * @fileOverview This file defines a Genkit flow to suggest HSN codes and tax percentages for materials.
 *
 * - suggestMaterialCategory - A function that handles the material category suggestion process.
 * - SuggestMaterialCategoryInput - The input type for the suggestMaterialCategory function.
 * - SuggestMaterialCategoryOutput - The return type for the suggestMaterialCategory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestMaterialCategoryInputSchema = z.object({
  itemName: z.string().describe('The name of the material to categorize.'),
});
export type SuggestMaterialCategoryInput = z.infer<typeof SuggestMaterialCategoryInputSchema>;

const SuggestMaterialCategoryOutputSchema = z.object({
  hsnCode: z
    .string()
    .describe('The Harmonized System of Nomenclature (HSN) code for the material.'),
  taxPercent: z.number().describe('The applicable tax percentage for the material.'),
});
export type SuggestMaterialCategoryOutput = z.infer<typeof SuggestMaterialCategoryOutputSchema>;

export async function suggestMaterialCategory(
  input: SuggestMaterialCategoryInput
): Promise<SuggestMaterialCategoryOutput> {
  return suggestMaterialCategoryFlow(input);
}

const suggestMaterialCategoryPrompt = ai.definePrompt({
  name: 'suggestMaterialCategoryPrompt',
  input: {schema: SuggestMaterialCategoryInputSchema},
  output: {schema: SuggestMaterialCategoryOutputSchema},
  prompt: `You are an expert in material classification and taxation in India. Your task is to accurately suggest the Harmonized System of Nomenclature (HSN) code and the applicable Goods and Services Tax (GST) percentage for a given item name.

Provide only the HSN code as a string and the tax percentage as a number.

Item Name: {{{itemName}}}`,
});

const suggestMaterialCategoryFlow = ai.defineFlow(
  {
    name: 'suggestMaterialCategoryFlow',
    inputSchema: SuggestMaterialCategoryInputSchema,
    outputSchema: SuggestMaterialCategoryOutputSchema,
  },
  async input => {
    const {output} = await suggestMaterialCategoryPrompt(input);
    return output!;
  }
);


