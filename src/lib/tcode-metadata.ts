/**
 * Clean T-Code metadata (codes and titles) without React component dependencies.
 * Safe to import in both server and client environments.
 */
export const TCODE_TITLES: Record<string, string> = {
  DB01: "Main Dashboard",
  XD01: "Create Customer",
  XD02: "Change Customer",
  XD03: "Display Customer List",
  ZCODE: "Active T-Code List",
  
  // Plant Management
  OP01: "Create Plant",
  OP02: "Edit Plant",
  OP03: "Display Plant List",
  
  // Firm Management
  FM01: "Create Firm",
  FM02: "Edit Firm",
  FM03: "Display Firm List",

  // Vendor Management
  XK01: "Create Vendor",
  XK02: "Change Vendor",
  XK03: "Display Vendor List",

  // Pricing (Condition Records)
  VK11: "Create Condition Record",
  VK12: "Change Condition Record",
  VK13: "Display Condition Records",

  // Material Management
  MM01: "Create Material",
  MM02: "Change Material",
  MM03: "Display Material List",

  // Billing Types
  VOF01: "Define Billing Types",
  VOF02: "Edit Billing Types",
  VOF03: "Display Billing Types",

  // Goods Movement
  MIGO: "Goods Movement / Receipts",

  // Billing / Invoicing
  VF01: "Create Billing Document",
  VF02: "Change Billing Document",
  VF03: "Display Billing List",
  VF11: "Cancel Billing Document",
  IRN01: "Generate IRN / E-Invoicing",
  IRN02: "Change IRN",
  IRN03: "Display IRN",
  ZINV: "Invoice Report",

  // Finance
  FB03: "Invoice Payment Status",
  MB03: "Payment Record",
  MB5B: "Payment List",
  MBST: "Reverse Payment / Modify Payment",
  F110: "Payment Proof Report",
  F51: "Post Outgoing Payment",
  F52: "Post Outgoing Payment Revise",
  F53: "Post Outgoing Payment Record",
  
  // User Management
  SU01: "Create User",
  SU02: "Change User",
  SU03: "Display Users",
};

export function isValidTcode(code: string): boolean {
  if (!code) return false;
  return Boolean(TCODE_TITLES[code.trim().toUpperCase()]);
}

export function getTcodeTitle(code: string): string | null {
  if (!code) return null;
  return TCODE_TITLES[code.trim().toUpperCase()] || null;
}
