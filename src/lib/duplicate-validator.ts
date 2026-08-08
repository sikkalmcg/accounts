import { collection, query, where, getDocs } from "@/database/mongo";

/**
 * Standardized error messages for duplicate validation across the application.
 * Matches the specification exactly.
 */
export const DUPLICATE_ERROR_MESSAGES: Record<string, string> = {
  plantId: "Plant ID already exists. Please enter a unique Plant ID.",
  invoiceNumber: "Invoice Number already exists. Duplicate invoices are not permitted.",
  customerId: "Customer ID already exists. Please use a unique Customer ID.",
  vendorCode: "Vendor ID already exists. Please use a unique Vendor ID.",
  vendorId: "Vendor ID already exists. Please use a unique Vendor ID.",
  firmId: "Firm ID already exists. Please use a unique Vendor ID.",
  irnNumber: "IRN Number already exists. Duplicate IRN Numbers are not allowed across all plants.",
  ackNo: "ACK Number already exists. Duplicate ACK Numbers are not allowed across all plants.",
  productName: "Material Name already exists. Please enter a unique Product Name.",
  materialCode: "Material Code already exists. Please enter a unique Material Code.",
};

/**
 * Get the error message for a given field.
 * Falls back to a generic message if the field is not in the map.
 */
export function getDuplicateErrorMessage(field: string): string {
  return DUPLICATE_ERROR_MESSAGES[field] || `${field} already exists. Please enter a unique ${field}.`;
}

/**
 * Normalize a string value for case-insensitive, trimmed comparison.
 * Trims leading/trailing whitespace and converts to uppercase.
 */
export function normalizeValue(value: string): string {
  return (value || "").trim().toUpperCase();
}

/**
 * Validate that a field value is unique across a collection.
 * Used for CREATE operations.
 *
 * @param db - The database instance
 * @param collectionName - The collection to search in
 * @param field - The field name to check for duplicates
 * @param value - The value to check
 * @returns The error message if a duplicate is found, or null if unique
 */
export async function validateDuplicate(
  db: any,
  collectionName: string,
  field: string,
  value: string
): Promise<string | null> {
  if (!value) return null;

  const normalizedValue = normalizeValue(value);
  const q = query(collection(db, collectionName), where(field, "==", normalizedValue));
  const snap = await getDocs(q);

  if (!snap.empty) {
    return getDuplicateErrorMessage(field);
  }

  return null;
}

/**
 * Validate that a field value is unique across a collection, excluding a specific document.
 * Used for EDIT operations where the current record should be excluded from the check.
 *
 * @param db - The database instance
 * @param collectionName - The collection to search in
 * @param field - The field name to check for duplicates
 * @param value - The value to check
 * @param excludeId - The document ID to exclude from the check
 * @returns The error message if a duplicate is found, or null if unique
 */
export async function validateDuplicateWithExclusion(
  db: any,
  collectionName: string,
  field: string,
  value: string,
  excludeId: string
): Promise<string | null> {
  if (!value) return null;

  const normalizedValue = normalizeValue(value);
  const q = query(collection(db, collectionName), where(field, "==", normalizedValue));
  const snap = await getDocs(q);

  const isDuplicate = snap.docs.some((doc: any) => doc.id !== excludeId);

  if (isDuplicate) {
    return getDuplicateErrorMessage(field);
  }

  return null;
}
