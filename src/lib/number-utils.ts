// src/lib/number-utils.ts

/**
 * Rounds a number to two decimal places.
 * @param num The number to round.
 * @returns The rounded number.
 */
export function roundToTwo(num: number): number {
  if (typeof num !== 'number' || isNaN(num)) {
    return num;
  }
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Recursively traverses an object or array and rounds all number values to two decimal places.
 * @param obj The object or array to process.
 * @returns The processed object or array with rounded numbers.
 */
export function roundObjectNumbers(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => roundObjectNumbers(item));
  }

  return Object.keys(obj).reduce((acc, key) => {
    const value = obj[key];
    if (typeof value === 'number') {
      acc[key] = roundToTwo(value);
    } else if (typeof value === 'object' && value !== null) { // Added null check for value
      acc[key] = roundObjectNumbers(value);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as { [key: string]: any });
}

/**
 * Formats a number to a string with two decimal places and commas.
 * @param num The number to format.
 * @returns The formatted string.
 */
export function formatCurrency(num: number | undefined | null): string {
    return formatAmount(num);
}

/**
 * Formats a number to exactly 2 decimal places with comma grouping.
 * Rejects/handles NaN gracefully. Always returns trailing zeros (e.g. 100 -> "100.00").
 * @param num The value to format (number, numeric string, or null/undefined).
 */
export function formatAmount(num: number | string | undefined | null): string {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (typeof n !== 'number' || isNaN(n) || n === null) {
        return '0.00';
    }
    return n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true
    });
}

/**
 * Sanitizes a user-entered amount string to allow at most 2 decimal places.
 * Rejects values with more than 2 decimal places. Returns the sanitized string.
 * @param value Raw user input.
 * @returns A safe string with at most 2 decimal places ("" allowed).
 */
export function sanitizeAmountInput(value: string): string {
    if (!value) return "";
    // Remove any non-numeric characters except one decimal point
    let cleaned = value.replace(/[^0-9.]/g, "");
    // Only keep the first decimal point
    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
        cleaned = cleaned.substring(0, firstDot + 1) + cleaned.substring(firstDot + 1).replace(/\./g, "");
    }
    // Limit to at most 2 decimal places
    if (cleaned.includes(".")) {
        const [intPart, decPart] = cleaned.split(".");
        cleaned = `${intPart}.${decPart.slice(0, 2)}`;
    }
    return cleaned;
}

/**
 * Parses an amount string/number to a rounded 2-decimal number.
 * @param value The value to parse (number or string).
 * @returns Rounded number (2 decimals) or 0.
 */
export function parseAmount(value: number | string | undefined | null): number {
    const n = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof n !== 'number' || isNaN(n)) {
        return 0;
    }
    return roundToTwo(n);
}
