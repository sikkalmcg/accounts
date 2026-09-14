
"use client";

import { 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  Star, 
  Package, 
  LayoutDashboard,
  Terminal,
  Factory,
  Building2,
  Tag,
  Truck,
  FileText,
  Layers,
  UserCog,
  QrCode,
  XCircle,
  CreditCard,
  ClipboardList,
  Settings
} from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

// Standard branding asset
import brandingImage from "@/assets/sikkalmclogin.jpeg";

export default function DB01() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string[]>(['favorites', 'sap-menu', 'm-logistics', 'm-invoice-grp', 'm-finance', 'm-reports']);
  const [userPerms, setUserPerms] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    if (stored) {
      const parsed = JSON.parse(stored);
      setUserPerms(parsed.tcodePermissions || []);
      setIsAdmin(parsed.role === 'admin' || parsed.username === "ajaysomra");
    }
  }, []);

  const hasAccess = (tcode?: string) => {
    if (isAdmin) return true;
    if (!tcode) return true; 
    return userPerms.includes(tcode);
  };

  const toggle = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const MenuItem = ({ id, label, icon: Icon, children, tcode }: any) => {
    const isExpanded = expanded.includes(id);
    const hasChildren = !!children;
    
    if (tcode && !hasAccess(tcode)) return null;

    const handleClick = () => {
      if (hasChildren) {
        toggle(id);
      } else if (tcode) {
        router.push(`/tcode/${tcode}`);
      }
    };

    return (
      <div className="select-inherit">
        <div 
          className="flex items-center gap-1 py-0.5 px-2 hover:bg-primary/10 cursor-pointer group whitespace-nowrap"
          onClick={handleClick}
        >
          <div className="w-4 flex items-center justify-center">
            {hasChildren && (isExpanded ? <ChevronDown className="h-3 w-3 text-primary" /> : <ChevronRight className="h-3 w-3 text-primary" />)}
          </div>
          {Icon && <Icon className="h-4 w-4 text-primary/80" />}
          <span className="text-[13px] text-foreground group-hover:text-primary">
            {label} {tcode && <span className="text-muted-foreground font-mono text-xs ml-2">[{tcode}]</span>}
          </span>
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-4 border-l border-gray-200">
            {children}
          </div>
        )}
      </div>
    );
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="db01-main-container flex flex-1 w-full h-[calc(100vh-105px)] overflow-hidden bg-white">
      {/* Mobile Toggle Bar */}
      <div className="md:hidden flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-gray-300 z-30 shrink-0">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Folder className="h-3.5 w-3.5 text-primary" />
          SAP Easy Access Menu
        </span>
        <button
          type="button"
          onClick={() => setSidebarOpen(prev => !prev)}
          className="px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
        >
          {sidebarOpen ? "Hide Menu ▲" : "Show Menu ▼"}
        </button>
      </div>

      {/* Left Sidebar - SAP Easy Access Menu */}
      <div className={`db01-sidebar ${!sidebarOpen ? "max-md:hidden" : ""} border-r border-gray-300 overflow-y-auto bg-white p-2 shrink-0 no-scrollbar relative z-20`}>
        <MenuItem id="favorites" label="Favorites" icon={Star}>
          <MenuItem id="f1" label="Main Dashboard" icon={LayoutDashboard} tcode="DB01" />
          <MenuItem id="f-vf01" label="Invoicing" icon={FileText} tcode="VF01" />
          <MenuItem id="f-migo" label="Goods Movement" icon={Truck} tcode="MIGO" />
        </MenuItem>
        
        <MenuItem id="sap-menu" label="Sikka Menu" icon={Folder}>
          <MenuItem id="m-org" label="Enterprise Structure" icon={Folder}>
            <MenuItem id="m-plant-grp" label="Plant Management" icon={Factory}>
              <MenuItem id="op01" label="Create Plant" tcode="OP01" />
              <MenuItem id="op02" label="Edit Plant" tcode="OP02" />
              <MenuItem id="op03" label="Display Plants" tcode="OP03" />
            </MenuItem>
            <MenuItem id="m-firm-grp" label="Firm Management" icon={Building2}>
              <MenuItem id="fm01" label="Create Firm" tcode="FM01" />
              <MenuItem id="fm02" label="Edit Firm" tcode="FM02" />
              <MenuItem id="fm03" label="Display Firms" tcode="FM03" />
            </MenuItem>
          </MenuItem>

          <MenuItem id="m-logistics" label="Logistics" icon={Package}>
            <MenuItem id="m-material-grp" label="Material Management" icon={Layers}>
              <MenuItem id="mm01" label="Create Material" tcode="MM01" />
              <MenuItem id="mm02" label="Change Material" tcode="MM02" />
              <MenuItem id="mm03" label="Display Materials" tcode="MM03" />
            </MenuItem>
            <MenuItem id="m1-1" label="Sales and Distribution" icon={Folder}>
              <MenuItem id="m1-1-2" label="Master Data" icon={Folder}>
                <MenuItem id="m1-1-2-1" label="Business Partner" icon={Folder}>
                  <MenuItem id="m1-1-2-1-1" label="Customer" icon={Folder}>
                    <MenuItem id="xd01" label="Create" tcode="XD01" />
                    <MenuItem id="xd02" label="Change" tcode="XD02" />
                    <MenuItem id="xd03" label="Display" tcode="XD03" />
                  </MenuItem>
                  <MenuItem id="m-vend-grp" label="Vendor" icon={Folder}>
                    <MenuItem id="xk01" label="Create" tcode="XK01" />
                    <MenuItem id="xk02" label="Change" tcode="XK02" />
                    <MenuItem id="xk03" label="Display" tcode="XK03" />
                  </MenuItem>
                </MenuItem>
              </MenuItem>
              <MenuItem id="m1-1-3" label="Pricing" icon={Tag}>
                <MenuItem id="vk11" label="Create Condition Record" tcode="VK11" />
                <MenuItem id="vk12" label="Change Condition Record" tcode="VK12" />
                <MenuItem id="vk13" label="Display Condition Records" tcode="VK13" />
              </MenuItem>
              <MenuItem id="m-bill-grp" label="Billing Definitions" icon={Tag}>
                <MenuItem id="vof01" label="Define Billing Types" tcode="VOF01" />
                <MenuItem id="vof02" label="Edit Billing Types" tcode="VOF02" />
                <MenuItem id="vof03" label="Display Billing Types" tcode="VOF03" />
              </MenuItem>
              <MenuItem id="m-invoice-grp" label="Billing / Invoicing" icon={FileText}>
                <MenuItem id="vf01" label="VF01 - Create Invoice" tcode="VF01" />
                <MenuItem id="vf02" label="VF02 - Change Invoice" tcode="VF02" />
                <MenuItem id="vf03" label="VF03 - Display Invoices" tcode="VF03" />
                <MenuItem id="vf11" label="VF11 - Cancel Invoice" icon={XCircle} tcode="VF11" />
                <MenuItem id="m-irn-grp" label="E-Invoicing (IRN)" icon={QrCode}>
                  <MenuItem id="irn01" label="IRN01 - Generate (Pending)" tcode="IRN01" />
                  <MenuItem id="irn02" label="IRN02 - Change IRN" tcode="IRN02" />
                  <MenuItem id="irn03" label="IRN03 - Display IRN" tcode="IRN03" />
                </MenuItem>
              </MenuItem>
            </MenuItem>
            <MenuItem id="m-goods" label="Goods Management" icon={Truck}>
              <MenuItem id="migo" label="MIGO - Goods Movement" tcode="MIGO" />
            </MenuItem>
          </MenuItem>

          <MenuItem id="m-finance" label="Accounting & Finance" icon={CreditCard}>
            <MenuItem id="fb03" label="FB03 - Invoice Payment Status" tcode="FB03" />
            <MenuItem id="f110" label="F110 - Payment Proof Report" tcode="F110" />
            <MenuItem id="f51" label="F51 - Post Outgoing Payment" tcode="F51" />
            <MenuItem id="f52" label="F52 - Revise Outgoing Payment" tcode="F52" />
            <MenuItem id="f53" label="F53 - Outgoing Payment Record" tcode="F53" />
          </MenuItem>

          <MenuItem id="m-reports" label="Information System" icon={ClipboardList}>
            <MenuItem id="zinv-rep" label="ZINV - Invoice Report" tcode="ZINV" />
          </MenuItem>

          <MenuItem id="m3" label="Tools & Security" icon={Settings}>
            <MenuItem id="su01-grp" label="User Management" icon={UserCog}>
              <MenuItem id="su01" label="Create User" tcode="SU01" />
              <MenuItem id="su02" label="Change User" tcode="SU02" />
              <MenuItem id="su03" label="Display Users" tcode="SU03" />
            </MenuItem>
            <MenuItem id="zcode-tool" label="Active T-Codes" icon={Terminal} tcode="ZCODE" />
          </MenuItem>
        </MenuItem>
      </div>

      {/* Main Workspace Area - Completely Stretched Width & Height */}
      <div className="db01-workspace relative overflow-hidden flex-1 w-full h-full">
        <div className="db01-image-wrapper absolute inset-0 w-full h-full p-0 m-0">
          <Image 
            src={brandingImage} 
            alt="Sikka Accounts Management System Background" 
            fill 
            className="db01-branding-image w-full h-full"
            style={{ objectFit: 'fill', width: '100%', height: '100%' }}
            sizes="100vw"
            priority
          />
        </div>
      </div>
    </div>
  );
}
