
import { format, parse, isValid } from "date-fns";

/**
 * Standard SAP-inspired formats for Sikka LMC
 */
export const SAP_DATE_FORMAT = "dd-MMM-yyyy";
export const SAP_MONTH_FORMAT = "MMM-yyyy";

/**
 * Converts a Date object or ISO string to DD-MMM-YYYY
 */
export const toSAPDate = (date: Date | string) => {
  if (!date) return "";
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return "";
  return format(d, SAP_DATE_FORMAT);
};

/**
 * Converts a Date object or ISO string to MMM-YYYY
 */
export const toSAPMonth = (date: Date | string) => {
  if (!date) return "";
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return "";
  return format(d, SAP_MONTH_FORMAT);
};

/**
 * Helper for HTML5 input type="date" which requires YYYY-MM-DD
 */
export const toInputDate = (sapDateString: string) => {
  if (!sapDateString) return "";
  try {
    const parsed = parse(sapDateString, SAP_DATE_FORMAT, new Date());
    if (!isValid(parsed)) return "";
    return format(parsed, "yyyy-MM-dd");
  } catch {
    return "";
  }
};

/**
 * Generates Financial Years starting from 2026-27.
 * Automatically adds the next year on April 1st.
 */
export const getFinancialYears = () => {
  const startYear = 2026;
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-indexed, April is 3
  
  // A FY starts April 1st.
  const activeYear = curMonth >= 3 ? curYear : curYear - 1;
  
  const fyears = [];
  for (let y = startYear; y <= Math.max(startYear, activeYear); y++) {
    fyears.push(`${y}-${(y + 1).toString().slice(-2)}`);
  }
  return fyears;
};

/**
 * Returns the current active financial year string
 */
export const getCurrentFinancialYear = () => {
  const fyears = getFinancialYears();
  return fyears[fyears.length - 1];
};


