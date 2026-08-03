/**
 * Shared CSV Export Utilities
 *
 * - UTF-8 (with BOM) support for Unicode
 * - Date & Time format: DD-MMM-YYYY HH:MM
 * - File naming: <PageName>_DD-MMM-YYYY_HHMM.csv
 *   Example: VF03_01-Aug-2026_1350.csv
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formats a Date to DD-MMM-YYYY (e.g. 01-Aug-2026) */
export const formatSapDate = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

/** Formats a Date to DD-MMM-YYYY HH:MM (e.g. 01-Aug-2026 14:35) */
export const formatSapDateTime = (d: Date): string => {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${formatSapDate(d)} ${hours}:${minutes}`;
};

/** Formats a Date to DD-MMM-YYYY_HHMM (used in file names, e.g. 01-Aug-2026_1350) */
export const formatSapFileStamp = (d: Date): string => {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${formatSapDate(d)}_${hours}${minutes}`;
};

/** Escapes a CSV cell value: quotes " and wraps in double quotes if needed */
export const csvCell = (value: any): string => {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/** Converts a 2D array (headers + rows) into a CSV string with UTF-8 BOM */
export const buildCsv = (headers: string[], rows: any[][]): string => {
  const headerLine = headers.map(csvCell).join(",");
  const bodyLines = rows.map((row) => row.map(csvCell).join(","));
  return "\uFEFF" + [headerLine, ...bodyLines].join("\r\n");
};

/**
 * Triggers a browser download of a CSV file.
 *
 * @param pageName - T-code / page name used in the file name (e.g. "VF03")
 * @param headers  - visible column headers to export
 * @param rows     - rows of data (already filtered/sorted as displayed)
 * @param opts     - optional overrides (date formatting, custom file name)
 */
export const downloadCsv = (
  pageName: string,
  headers: string[],
  rows: any[][],
  opts?: { useDateTime?: boolean; fileName?: string }
) => {
  if (!rows || rows.length === 0) return;

  const now = new Date();
  const fileName =
    opts?.fileName ||
    `${pageName}_${formatSapFileStamp(now)}.csv`;

  // Support Unicode (UTF-8 BOM) - buildCsv already prepends the BOM
  const csvContent = buildCsv(headers, rows);

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  window.dispatchEvent(
    new CustomEvent("sap-status", {
      detail: { text: `CSV export triggered: ${fileName}`, isError: false },
    })
  );
};

