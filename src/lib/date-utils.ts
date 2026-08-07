
import { format, isValid } from "date-fns";

/**
 * Standard SAP-inspired formats for Sikka LMC
 */
export const SAP_DATE_FORMAT = "dd-MMM-yyyy";
export const SAP_MONTH_FORMAT = "MMM-yyyy";

/**
 * Standard US-style date format for Sikka LMC
 */
export const US_DATE_FORMAT = "MM/dd/yyyy";

/**
 * Standard HTML input date format
 */
export const INPUT_DATE_FORMAT = "yyyy-MM-dd";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const isSapDateString = (s: string) => /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(s);
const isIsoDateString = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Converts a Date, ISO string, or epoch number to MM/DD/YYYY (e.g. 08/07/2026).
 * Returns an empty string for invalid or empty inputs.
 */
export const formatDate = (date: Date | string | number): string => {
  if (!date && date !== 0) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (!isValid(d)) return "";
  return format(d, US_DATE_FORMAT);
};

/**
 * Converts a Date object or date string to DD-MMM-YYYY.
 *
 * Accepts:
 *  - ISO `YYYY-MM-DD` (stored internally) – parsed directly without timezone shift
 *  - `DD-MMM-YYYY` (already formatted, any case) – normalized as-is
 *  - Date objects / full ISO timestamps
 *
 * Returns "" for invalid/empty input.
 */
export const toSAPDate = (date: Date | string) => {
  if (!date) return "";
  if (typeof date === "string") {
    const s = date.trim();
    // Already in SAP display format (possibly uppercase) -> normalize to Title case
    if (isSapDateString(s)) {
      const day = s.slice(0, 2);
      const month = s.slice(3, 6);
      const year = s.slice(7);
      const normalizedMonth = month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
      return `${day}-${normalizedMonth}-${year}`;
    }
    // Internal ISO "yyyy-MM-dd" -> format directly without timezone shifting
    if (isIsoDateString(s)) {
      const [y, m, d] = s.split("-").map(Number);
      if (m < 1 || m > 12 || d < 1 || d > 31) return "";
      const iso = new Date(y, m - 1, d);
      if (!isValid(iso)) return "";
      // Round-trip guard: make sure the date actually exists (e.g. 31-Feb)
      if (iso.getFullYear() !== y || iso.getMonth() !== m - 1 || iso.getDate() !== d) return "";
      return format(iso, SAP_DATE_FORMAT);
    }
    // Full ISO timestamp or other parseable string
    const d = new Date(date);
    if (!isValid(d)) return "";
    return format(d, SAP_DATE_FORMAT);
  }
  const d = date;
  if (!isValid(d)) return "";
  return format(d, SAP_DATE_FORMAT);
};

/**
 * Parses a DD-MMM-YYYY string into a Date object.
 * Enforces strict format: DD = 2 digits, MMM = 3 alphabetic chars, YYYY = 4 digits.
 * Rejects invalid dates (e.g. 31-Feb-2026, 00-Jan-2026).
 * Returns null for invalid or empty inputs.
 */
export const parseSAPDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const s = dateString.trim();
  if (!isSapDateString(s)) return null;

  const day = parseInt(s.slice(0, 2), 10);
  const monthRaw = s.slice(3, 6);
  const year = parseInt(s.slice(7), 10);

  const monthIdx = SHORT_MONTHS.findIndex(m => m.toUpperCase() === monthRaw.toUpperCase());
  if (monthIdx === -1) return null;

  if (day < 1 || day > 31 || year < 1 || year > 9999) return null;

  const d = new Date(year, monthIdx, day);
  if (!isValid(d)) return null;
  // Guard against overflow (e.g. 31-Feb -> Mar 2/3)
  if (d.getFullYear() !== year || d.getMonth() !== monthIdx || d.getDate() !== day) return null;

  return d;
};

/**
 * Converts a DD-MMM-YYYY (any case) or ISO YYYY-MM-DD string to canonical ISO YYYY-MM-DD.
 * Returns "" for invalid/empty input.
 */
export const toIsoDate = (dateString: string): string => {
  if (!dateString) return "";
  const s = dateString.trim();
  if (isIsoDateString(s)) return s;
  const parsed = parseSAPDate(s);
  if (!parsed) return "";
  return format(parsed, INPUT_DATE_FORMAT);
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
  const parsed = parseSAPDate(sapDateString);
  if (!parsed) return "";
  return format(parsed, INPUT_DATE_FORMAT);
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


