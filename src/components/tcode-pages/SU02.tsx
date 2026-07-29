
"use client";

import { useState, useEffect, useCallback } from "react";
import { useDatabase, useCollection, useMemoDatabase, updateDocumentNonBlocking } from "@/database";
import { collection, doc, query, orderBy } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserCog, ShieldCheck, Lock, Globe, Search } from "lucide-react";

// Synchronized T-Code groups for inheritance
const TCODE_GROUPS: Record<string, { label: string; codes: string[] }> = {
  "DB01": { label: "Main Dashboard", codes: ["DB01"] },
  "FM01": { label: "Firm Maintenance", codes: ["FM01", "FM02", "FM03"] },
  "OP01": { label: "Plant Maintenance", codes: ["OP01", "OP02", "OP03"] },
  "XD01": { label: "Customer Master", codes: ["XD01", "XD02", "XD03"] },
  "XK01": { label: "Vendor Master", codes: ["XK01", "XK02", "XK03"] },
  "MM01": { label: "Material Master", codes: ["MM01", "MM02", "MM03"] },
  "VOF01": { label: "Billing Definitions", codes: ["VOF01", "VOF02", "VOF03"] },
  "VK11": { label: "Pricing Conditions", codes: ["VK11", "VK12", "VK13"] },
  "VL01": { label: "Price Condition (Detailed)", codes: ["VL01", "VL02", "VL03"] },
  "VF01": { label: "Billing & Invoicing", codes: ["VF01", "VF02", "VF03", "VF11"] },
  "IRN01": { label: "E-Invoicing (IRN)", codes: ["IRN01", "IRN02", "IRN03"] },
  "MIGO": { label: "Goods Movement", codes: ["MIGO"] },
  "FB03": { label: "Payment Status", codes: ["FB03"] },
  "F110": { label: "Payment Audit", codes: ["F110"] },
  "ZINV": { label: "Invoice Report", codes: ["ZINV"] },
  "SU01": { label: "User Management", codes: ["SU01", "SU02", "SU03"] },
  "ZCODE": { label: "System Tools", codes: ["ZCODE"] },
};

export default function SU02() {
  const db = useDatabase();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Master Data
  const usersQuery = useMemoDatabase(() => query(collection(db, "users"), orderBy("username", "asc")), [db]);
  const { data: users, isLoading: isUsersLoading } = useCollection(usersQuery);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);

  const primaryTcodes = Object.keys(TCODE_GROUPS).sort();

  const handleSelectUser = (id: string) => {
    const user = users?.find(u => u.id === id);
    if (user) {
      setFormData({
        ...user,
        assignedPlantIds: user.assignedPlantIds || (user.assignedPlantId ? [user.assignedPlantId] : []),
        tcodePermissions: user.tcodePermissions || ["DB01"]
      });
      setSelectedUserId(id);
    }
  };

  const togglePermission = (primaryCode: string) => {
    if (!formData) return;
    const groupCodes = TCODE_GROUPS[primaryCode].codes;
    const current = formData.tcodePermissions || [];
    
    let updated;
    if (current.includes(primaryCode)) {
      // Remove entire group
      updated = current.filter((c: string) => !groupCodes.includes(c));
    } else {
      // Add entire group
      updated = Array.from(new Set([...current, ...groupCodes]));
    }
    setFormData({ ...formData, tcodePermissions: updated });
  };

  const togglePlant = (plantId: string) => {
    if (!formData) return;
    const current = formData.assignedPlantIds || [];
    const updated = current.includes(plantId)
      ? current.filter((id: string) => id !== plantId)
      : [...current, plantId];
    setFormData({ ...formData, assignedPlantIds: updated });
  };

  const selectAll = () => setFormData({ ...formData, tcodePermissions: Object.values(TCODE_GROUPS).flatMap(g => g.codes) });
  const selectNone = () => setFormData({ ...formData, tcodePermissions: ["DB01"] });

  const handleExecute = useCallback(async () => {
    if (!formData || !selectedUserId) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "Error: No user selected for modification", isError: true } 
      }));
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, "users", selectedUserId);
      const { id, assignedPlantId, ...dataToUpdate } = formData;
      updateDocumentNonBlocking(userRef, dataToUpdate);
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: `User ${formData.username} profile updated successfully`, isError: false } 
      }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('sap-status', { 
        detail: { text: "System Error: Failed to update user profile", isError: true } 
      }));
    } finally {
      setLoading(false);
    }
  }, [formData, selectedUserId, db]);

  useEffect(() => {
    const onExec = () => handleExecute();
    window.addEventListener('sap-execute', onExec);
    return () => window.removeEventListener('sap-execute', onExec);
  }, [handleExecute]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          User Maintenance: Change User Profile
        </h2>
      </div>

      <div className="p-4 space-y-6 flex-1 overflow-auto">
        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
          <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex items-center gap-2">
            <Search className="h-3.5 w-3.5" /> User Selection
          </div>
          <div className="p-3">
            <div className="sap-selection-row">
              <label className="sap-label">Select User</label>
              <div className="sap-input-wrapper max-md">
                <Select onValueChange={handleSelectUser} value={selectedUserId}>
                  <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Choose user to edit" />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.username} - {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isUsersLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
              </div>
            </div>
          </div>
        </div>

        {formData && (
          <div className="animate-in fade-in duration-300 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9] h-fit">
                <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex items-center gap-2">
                  <UserCog className="h-3.5 w-3.5" /> Identity & Credentials
                </div>
                <div className="p-3 space-y-2">
                  <div className="sap-selection-row"><label className="sap-label">Username</label><Input value={formData.username} disabled className="max-w-[200px] bg-gray-100 cursor-not-allowed" /></div>
                  <div className="sap-selection-row"><label className="sap-label">Password</label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="max-w-[200px]" /></div>
                  <div className="sap-selection-row"><label className="sap-label">Full Name</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                  <div className="sap-selection-row">
                    <label className="sap-label">Role</label>
                    <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                      <SelectTrigger className="h-6 rounded-none border-gray-400 bg-white text-xs px-1.5 focus:bg-[#fff9c4] max-w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="user">Standard User</SelectItem><SelectItem value="admin">System Admin</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9] h-fit min-h-[220px] flex flex-col">
                <div className="bg-[#dae8f5] px-3 py-0.5 border-b border-[#b5c7de] text-[12px] font-semibold text-gray-700 flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Organizational Assignment</div>
                <div className="p-3 space-y-2 flex-1 flex flex-col overflow-hidden">
                  <label className="text-[11px] font-bold text-blue-800 uppercase tracking-tighter mb-1">Authorized Plant Access *</label>
                  <div className="flex-1 bg-white border border-gray-300 overflow-y-auto no-scrollbar p-2 grid grid-cols-2 gap-2">
                    {isPlantsLoading ? (
                      <div className="flex items-center gap-2 text-gray-400 text-xs py-4 col-span-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching Plant List...</div>
                    ) : plants?.map(p => (
                      <div key={p.id} className="flex items-center space-x-2 p-1 hover:bg-blue-50 transition-colors rounded border border-transparent hover:border-blue-100">
                        <Checkbox id={`p-${p.plantId}`} checked={formData.assignedPlantIds?.includes(p.plantId)} onCheckedChange={() => togglePlant(p.plantId)} className="h-3.5 w-3.5" />
                        <label htmlFor={`p-${p.plantId}`} className="text-[11px] font-bold text-gray-700 cursor-pointer select-none truncate">{p.plantId} - {p.name}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
              <div className="bg-[#dae8f5] px-3 py-1 border-b border-[#b5c7de] flex items-center justify-between">
                <div className="text-[12px] font-semibold text-gray-700 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Functional Authorization (Grouped)</div>
                <div className="flex gap-2">
                  <Button onClick={selectAll} variant="ghost" className="h-6 text-[10px] uppercase font-bold">Grant All</Button>
                  <Button onClick={selectNone} variant="ghost" className="h-6 text-[10px] uppercase font-bold">Reset</Button>
                </div>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto no-scrollbar">
                {primaryTcodes.map(code => (
                  <div key={code} className="flex items-start space-x-3 p-2 hover:bg-blue-50 rounded border border-gray-100 transition-colors group">
                    <Checkbox id={`perm-${code}`} checked={formData.tcodePermissions?.includes(code)} onCheckedChange={() => togglePermission(code)} className="h-4 w-4 mt-0.5" />
                    <label htmlFor={`perm-${code}`} className="flex flex-col cursor-pointer select-none">
                      <span className="text-[12px] font-black font-mono text-blue-900 group-hover:text-blue-600">{code}</span>
                      <span className="text-[10px] font-bold text-gray-500 uppercase leading-tight">{TCODE_GROUPS[code].label}</span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="bg-[#e7ebf1] p-1.5 px-4 text-[9px] font-bold text-gray-400 uppercase italic">
                Related transactions (Create/Change/Display) are automatically synchronized when a primary functional group is authorized.
              </div>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="fixed bottom-10 right-10 bg-[#333e4f] text-white px-4 py-2 text-xs flex items-center gap-2 border border-white/20 animate-pulse">
          <Lock className="h-3.5 w-3.5" /> Committing Changes...
        </div>
      )}
    </div>
  );
}


