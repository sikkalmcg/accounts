import DB01 from "@/components/tcode-pages/DB01";
import XD01 from "@/components/tcode-pages/XD01";
import XD02 from "@/components/tcode-pages/XD02";
import XD03 from "@/components/tcode-pages/XD03";
import ZCODE from "@/components/tcode-pages/ZCODE";
import OP01 from "@/components/tcode-pages/OP01";
import OP02 from "@/components/tcode-pages/OP02";
import OP03 from "@/components/tcode-pages/OP03";
import FM01 from "@/components/tcode-pages/FM01";
import FM02 from "@/components/tcode-pages/FM02";
import FM03 from "@/components/tcode-pages/FM03";
import XK01 from "@/components/tcode-pages/XK01";
import XK02 from "@/components/tcode-pages/XK02";
import XK03 from "@/components/tcode-pages/XK03";
import VK11 from "@/components/tcode-pages/VK11";
import VK12 from "@/components/tcode-pages/VK12";
import VK13 from "@/components/tcode-pages/VK13";
import VL01 from "@/components/tcode-pages/VL01";
import VL02 from "@/components/tcode-pages/VL02";
import VL03 from "@/components/tcode-pages/VL03";
import VOF01 from "@/components/tcode-pages/VOF01";
import VOF02 from "@/components/tcode-pages/VOF02";
import VOF03 from "@/components/tcode-pages/VOF03";
import MIGO from "@/components/tcode-pages/MIGO";
import VF01 from "@/components/tcode-pages/VF01";
import VF02 from "@/components/tcode-pages/VF02";
import VF03 from "@/components/tcode-pages/VF03";
import VF11 from "@/components/tcode-pages/VF11";
import IRN01 from "@/components/tcode-pages/IRN01";
import IRN02 from "@/components/tcode-pages/IRN02";
import IRN03 from "@/components/tcode-pages/IRN03";
import MM01 from "@/components/tcode-pages/MM01";
import MM02 from "@/components/tcode-pages/MM02";
import MM03 from "@/components/tcode-pages/MM03";
import SU01 from "@/components/tcode-pages/SU01";
import SU02 from "@/components/tcode-pages/SU02";
import SU03 from "@/components/tcode-pages/SU03";
import FB03 from "@/components/tcode-pages/FB03";
import MB03 from "@/components/tcode-pages/MB03";
import MBST from "@/components/tcode-pages/MBST";
import ZINV from "@/components/tcode-pages/ZINV";
import F110 from "@/components/tcode-pages/F110";
import F51 from "@/components/tcode-pages/F51";
import F52 from "@/components/tcode-pages/F52";
import F53 from "@/components/tcode-pages/F53";

export const TCODE_MAP: Record<string, { title: string; component: React.ReactNode; isDisplayOnly?: boolean }> = {
  DB01: { title: "Main Dashboard", component: <DB01 /> },
  XD01: { title: "Create Customer", component: <XD01 /> },
  XD02: { title: "Change Customer", component: <XD02 /> },
  XD03: { title: "Display Customer List", component: <XD03 />, isDisplayOnly: true },
  ZCODE: { title: "Active T-Code List", component: <ZCODE />, isDisplayOnly: true },
  
  // Plant Management
  OP01: { title: "Create Plant", component: <OP01 /> },
  OP02: { title: "Edit Plant", component: <OP02 /> },
  OP03: { title: "Display Plant List", component: <OP03 />, isDisplayOnly: true },
  
  // Firm Management
  FM01: { title: "Create Firm", component: <FM01 /> },
  FM02: { title: "Edit Firm", component: <FM02 /> },
  FM03: { title: "Display Firm List", component: <FM03 />, isDisplayOnly: true },

  // Vendor Management
  XK01: { title: "Create Vendor", component: <XK01 /> },
  XK02: { title: "Change Vendor", component: <XK02 /> },
  XK03: { title: "Display Vendor List", component: <XK03 />, isDisplayOnly: true },

  // Pricing (Condition Records)
  VK11: { title: "Create Condition Record", component: <VK11 /> },
  VK12: { title: "Change Condition Record", component: <VK12 /> },
  VK13: { title: "Display Condition Records", component: <VK13 />, isDisplayOnly: true },

  // Price Condition (Detailed)
  VL01: { title: "Create Price Condition", component: <VL01 /> },
  VL02: { title: "Edit Price Condition", component: <VL02 /> },
  VL03: { title: "Display Price Condition List", component: <VL03 />, isDisplayOnly: true },

  // Material Management
  MM01: { title: "Create Material", component: <MM01 /> },
  MM02: { title: "Change Material", component: <MM02 /> },
  MM03: { title: "Display Material List", component: <MM03 />, isDisplayOnly: true },

  // Billing Types
  VOF01: { title: "Define Billing Types", component: <VOF01 /> },
  VOF02: { title: "Edit Billing Types", component: <VOF02 /> },
  VOF03: { title: "Display Billing Types", component: <VOF03 />, isDisplayOnly: true },

  // Goods Movement
  MIGO: { title: "Goods Movement / Receipts", component: <MIGO /> },

  // Billing / Invoicing
  VF01: { title: "Create Billing Document", component: <VF01 /> },
  VF02: { title: "Change Billing Document", component: <VF02 /> },
  VF03: { title: "Display Billing List", component: <VF03 />, isDisplayOnly: true },
  VF11: { title: "Cancel Billing Document", component: <VF11 /> },
  IRN01: { title: "Generate IRN / E-Invoicing", component: <IRN01 /> },
  IRN02: { title: "Change IRN", component: <IRN02 /> },
  IRN03: { title: "Display IRN", component: <IRN03 />, isDisplayOnly: true },
  ZINV: { title: "Invoice Report", component: <ZINV />, isDisplayOnly: true },

  // Finance
  FB03: { title: "Invoice Payment Status", component: <FB03 />, isDisplayOnly: true },
  MB03: { title: "Payment Record", component: <MB03 />, isDisplayOnly: true },
  MBST: { title: "Reverse Payment / Modify Payment", component: <MBST /> },
  F110: { title: "Payment Proof Report", component: <F110 />, isDisplayOnly: true },
  F51: { title: "Post Outgoing Payment", component: <F51 /> },
  F52: { title: "Post Outgoing Payment Revise", component: <F52 /> },
  F53: { title: "Post Outgoing Payment Record", component: <F53 />, isDisplayOnly: true },
  
  // User Management
  SU01: { title: "Create User", component: <SU01 /> },
  SU02: { title: "Change User", component: <SU02 /> },
  SU03: { title: "Display Users", component: <SU03 />, isDisplayOnly: true },
};

