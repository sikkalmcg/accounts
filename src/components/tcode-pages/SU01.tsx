"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDatabase, useCollection, useMemoDatabase, setDocumentNonBlocking, updateDocumentNonBlocking } from "@/database";
import { collection, query, where, getDocs, doc, serverTimestamp, orderBy } from "@/database/mongo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, ShieldCheck, Lock, Globe } from "lucide-react";

const initialUser = {
  username: "",
  password: "",
  name: "",
  assignedPlantIds: [] as string[],
  role: "user",
  tcodePermissions: ["DB01"],
  editHistory: [] as any[],
};

// Every transaction code in the system, grouped by functional module.
const TCODE_GROUPS: Record<string, { label: string; codes: string[] }> = {
  "DB01": { label: "Main Dashboard", codes: ["DB01"] },
  "FM01": { label: "Firm Management", codes: ["FM01", "FM02", "FM03"] },
  "OP01": { label: "Plant Management", codes: ["OP01", "OP02", "OP03"] },
  "XD01": { label: "Customer Master", codes: ["XD01", "XD02", "XD03"] },
  "XK01": { label: "Vendor Master", codes: ["XK01", "XK02", "XK03"] },
  "MM01": { label: "Material Master", codes: ["MM01", "MM02", "MM03"] },
  "VOF01": { label: "Billing Types", codes: ["VOF01", "VOF02", "VOF03"] },
  "VK11": { label: "Pricing Records", codes: ["VK11", "VK12", "VK13"] },

  "VF01": { label: "Billing & Invoicing", codes: ["VF01", "VF02", "VF03", "VF11"] },
  "IRN01": { label: "E-Invoicing", codes: ["IRN01", "IRN02", "IRN03"] },
  "MIGO": { label: "Goods Movement", codes: ["MIGO"] },
  "MB5B": { label: "Payment Summary Report", codes: ["MB5B"] },
  "FB03": { label: "Account Analysis", codes: ["FB03", "F110"] },
  "MB03": { label: "Payment Records", codes: ["MB03", "MBST"] },
  "F51": { label: "Outgoing Payment", codes: ["F51", "F52", "F53"] },
  "ZINV": { label: "Invoice Report", codes: ["ZINV"] },
  "SU01": { label: "Security & Tools", codes: ["SU01", "SU02", "SU03", "ZCODE"] },
};

const ALL_TCODES = Object.values(TCODE_GROUPS).flatMap(g => g.codes);

export default function SU01() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useDatabase();
  const [formData, setFormData] = useState(initialUser);
  const [permissions, setPermissions] = useState<string[]>(["DB01"]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<any>(null);

  const plantsQuery = useMemoDatabase(() => collection(db, "plants"), [db]);
  const { data: plants, isLoading: isPlantsLoading } = useCollection(plantsQuery);
  const usersQuery = useMemoDatabase(() => query(collection(db, "users"), orderBy("createdAt", "desc")), [db]);
  const { data: users } = useCollection(usersQuery);

  const primaryTcodes = Object.keys(TCODE_GROUPS).sort();

  const togglePermission = (code: string) => {
    setPermissions(prev => {
      if (prev.includes(code)) {
        return prev.filter(c => c !== code);
      }
      return [...prev, code];
    });
  };

  const toggleModule = (primaryCode: string) => {
    const groupCodes = TCODE_GROUPS[primaryCode].codes;
    setPermissions(prev => {
      const allSelected = groupCodes.every(c => prev.includes(c));
      if (allSelected) {
        return prev.filter(c => !groupCodes.includes(c));
      }
      return Array.from(new Set([...prev, ...groupCodes]));
    });
  };

  const togglePlant = (plantId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedPlantIds: prev.assignedPlantIds.includes(plantId)
        ? prev.assignedPlantIds.filter(id => id !== plantId)
        : [...prev.assignedPlantIds, plantId]
    }));
  };

  const selectAll = () => setPermissions(ALL_TCODES);
  const selectNone = () => setPermissions(["DB01"]);

  useEffect(() => {
    const editUserId = searchParams.get("editUser");
    if (!editUserId || !users) return;
    const user = users.find(u => u.id === editUserId);
    if (!user) return;

    setSelectedUserId(editUserId);
    setIsEditMode(true);
    setEditSnapshot(user);
    setFormData({
      ...initialUser,
      ...user,
      assignedPlantIds: user.assignedPlantIds || (user.assignedPlantId ? [user.assignedPlantId] : []),
      tcodePermissions: user.tcodePermissions || ["DB01"],
      editHistory: user.editHistory || [],
    });
    setPermissions(user.tcodePermissions || ["DB01"]);
  }, [searchParams, users]);

  const resetForm = () => {
    setFormData(initialUser);
    setPermissions(["DB01"]);
    setSelectedUserId(null);
    setIsEditMode(false);
    setEditSnapshot(null);
    router.replace("/tcode/SU01", { scroll: false });
  };

  const handleExecute = useCallback(async () => {
    if (!formData.username || !formData.password || formData.assignedPlantIds.length === 0) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: "Error: Mandatory fields missing", isError: true } }));
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("username", "==", formData.username));
      const snap = await getDocs(q);
      if (!snap.empty && (!isEditMode || snap.docs[0].id !== selectedUserId)) throw new Error("Duplicate User");

      if (isEditMode && selectedUserId) {
        const userRef = doc(db, "users", selectedUserId);
        const historyEntry = {
          timestamp: serverTimestamp(),
          updatedBy: formData.username,
          before: editSnapshot,
          after: {
            ...formData,
            tcodePermissions: permissions,
          },
        };

        updateDocumentNonBlocking(userRef, {
          ...formData,
          tcodePermissions: permissions,
          updatedAt: serverTimestamp(),
          editHistory: [...(formData.editHistory || []), historyEntry],
        });

        window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `User ${formData.username} updated`, isError: false } }));
        resetForm();
        return;
      }

      const newUserRef = doc(collection(db, "users"));
      setDocumentNonBlocking(newUserRef, {
        ...formData,
        id: newUserRef.id,
        tcodePermissions: permissions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        editHistory: [],
      });

      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `User ${formData.username} created`, isError: false } }));
      setFormData(initialUser);
      setPermissions(["DB01"]);
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('sap-status', { detail: { text: `Error: ${e.message}`, isError: true } }));
    } finally {
      setLoading(false);
    }
  }, [formData, permissions, db, isEditMode, selectedUserId, editSnapshot, router]);

  useEffect(() => {
    window.addEventListener('sap-execute', handleExecute);
    return () => window.removeEventListener('sap-execute', handleExecute);
  }, [handleExecute]);

  return (
    <div className="w-full flex flex-col bg-white min-h-full">
      <div className="bg-[#dae8f5] px-4 py-1 border-b border-gray-300">
        <h2 className="text-[13px] font-bold text-gray-800 uppercase italic tracking-wider">
          User Maintenance: {isEditMode ? "Edit" : "Create"}
        </h2>
      </div>

      <div className="p-4 space-y-6 flex-1 overflow-auto">
        <div className="grid grid-cols-2 gap-6">
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b text-[12px] font-semibold flex items-center gap-2"><UserPlus size={14} /> Identity</div>
            <div className="p-3 space-y-2">
              <div className="sap-selection-row"><label className="sap-label">Username</label><Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.toLowerCase()})} /></div>
              <div className="sap-selection-row"><label className="sap-label">Password</label><Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
              <div className="sap-selection-row"><label className="sap-label">Full Name</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            </div>
          </div>

          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-[#f9f9f9] min-h-[180px]">
            <div className="bg-[#dae8f5] px-3 py-0.5 border-b text-[12px] font-semibold flex items-center gap-2"><Globe size={14} /> Plant Access</div>
            <div className="p-3 grid grid-cols-2 gap-2 overflow-y-auto max-h-[200px]">
              {plants?.map(p => (
                <div key={p.id} className="flex items-center space-x-2 p-1 hover:bg-blue-50 rounded">
                  <Checkbox id={`p-${p.plantId}`} checked={formData.assignedPlantIds.includes(p.plantId)} onCheckedChange={() => togglePlant(p.plantId)} />
                  <label htmlFor={`p-${p.plantId}`} className="text-[11px] font-bold cursor-pointer">{p.plantId} - {p.name}</label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
          <div className="bg-[#dae8f5] px-3 py-1 border-b font-semibold text-[12px] flex items-center justify-between">
            <div className="flex items-center gap-2"><ShieldCheck size={14} /> Functional Permissions (All Pages)</div>
            <div className="flex gap-2">
              <Button onClick={selectAll} variant="ghost" className="h-6 text-[10px] uppercase font-bold">Grant All</Button>
              <Button onClick={selectNone} variant="ghost" className="h-6 text-[10px] uppercase font-bold">Reset</Button>
            </div>
          </div>
          <div className="p-4 space-y-5 max-h-[420px] overflow-y-auto no-scrollbar">
            {primaryTcodes.map(code => {
              const groupCodes = TCODE_GROUPS[code].codes;
              const allSelected = groupCodes.every(c => permissions.includes(c));
              return (
                <div key={code} className="border border-gray-200 rounded-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#f0f4f8] border-b border-gray-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox id={`mod-${code}`} checked={allSelected} onCheckedChange={() => toggleModule(code)} />
                      <span className="text-[11px] font-black text-blue-900 uppercase">{TCODE_GROUPS[code].label}</span>
                    </label>
                    <span className="text-[9px] font-mono text-gray-500">{groupCodes.join(", ")}</span>
                  </div>
                  <div className="px-3 py-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {groupCodes.map(tcode => (
                      <div key={tcode} className="flex items-center space-x-2 p-1 hover:bg-blue-50 rounded">
                        <Checkbox id={`perm-${tcode}`} checked={permissions.includes(tcode)} onCheckedChange={() => togglePermission(tcode)} />
                        <label htmlFor={`perm-${tcode}`} className="text-[11px] font-bold font-mono text-gray-700 cursor-pointer">{tcode}</label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-[#e7ebf1] p-1.5 px-4 text-[9px] font-bold text-gray-400 uppercase italic">
            Each page (Create/Change/Display) is assigned individually. Check module header to grant all pages in that module.
          </div>
        </div>

        {isEditMode && (
          <div className="border border-[#b5c7de] rounded-sm overflow-hidden bg-white">
            <div className="bg-[#dae8f5] px-3 py-1 border-b font-semibold text-[12px] text-gray-700">Audit Trail</div>
            <div className="p-4 space-y-3 max-h-[260px] overflow-y-auto no-scrollbar text-[11px] text-gray-700">
              {formData.editHistory?.length > 0 ? (
                formData.editHistory.map((entry: any, idx: number) => (
                  <div key={idx} className="rounded-sm border border-gray-200 bg-[#f9fbff] p-3">
                    <div className="flex items-center justify-between gap-2 text-[10px] uppercase font-bold text-gray-500 mb-2">
                      <span>Revision {idx + 1}</span>
                      <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="space-y-1">
                      <div><span className="font-black">Updated By:</span> {entry.updatedBy || "System"}</div>
                      <div><span className="font-black">Before:</span> {entry.before?.name || entry.before?.username || "-"}</div>
                      <div><span className="font-black">After:</span> {entry.after?.name || entry.after?.username || "-"}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-gray-500">No audit history recorded for this user yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
