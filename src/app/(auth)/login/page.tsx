"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Check, Monitor, Settings, Minus, Square, X, ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useDatabase, initiateAnonymousSignIn } from "@/database";
import { collection, query, where, getDocs } from "@/database/mongo";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("EN");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useDatabase();

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username || !password) return;

    setIsAuthenticating(true);
    try {
      // Fetch the account from MongoDB.
      const q = query(collection(db, "users"), where("username", "==", username.toLowerCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("Invalid username or password");
      }

      const userDoc = snap.docs[0].data();
      if (userDoc.password !== password) {
        throw new Error("Invalid username or password");
      }

      // Store the authenticated application's session details.
      initiateAnonymousSignIn(auth);
      
localStorage.setItem("sikka_user", JSON.stringify({
        username: userDoc.username,
        name: userDoc.name,
        employeeId: userDoc.employeeId || userDoc.username,
        designation: userDoc.designation || '',
        department: userDoc.department || '',
        mobile: userDoc.mobile || '',
        email: userDoc.email || '',
        preferredLanguage: userDoc.preferredLanguage || 'en',
        timeZone: userDoc.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        dateFormat: userDoc.dateFormat || 'DD/MM/YYYY',
        timeFormat: userDoc.timeFormat || '12h',
        profilePhoto: userDoc.profilePhoto || '',
        theme: userDoc.theme || 'Classic',
        role: userDoc.role || 'user',
        assignedPlantIds: userDoc.assignedPlantIds || [],
        tcodePermissions: userDoc.tcodePermissions || [],
        lastLogin: new Date().toISOString(),
        accountStatus: 'Active',
      }));

      // Record login in audit log (fire-and-forget)
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userDoc.username,
          username: userDoc.name || userDoc.username,
          action: 'LOGIN',
          settingName: 'User Session',
          previousValue: null,
          newValue: 'Logged in',
        }),
      }).catch(() => {});

      // Update last login timestamp
      fetch('/api/user-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userDoc.username,
          lastLogin: new Date().toISOString(),
        }),
      }).catch(() => {});

      router.push("/tcode/DB01");
    } catch (err: any) {
      toast({
        title: "Login Failed",
        description: err.message || "An authentication error occurred",
        variant: "destructive",
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleLogin();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [username, password]);

  return (
    <div className="flex flex-col min-h-screen bg-[#f0f8f0] font-sans text-sm overflow-hidden select-none">
      {/* Standard SAP GUI Header */}
      <div className="bg-[#b7dbb7] border-b border-[#8fb38f] px-2 py-0.5 flex items-center justify-between text-[#1a3a1a]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 cursor-default hover:bg-[#a1c7a1] px-1.5 py-0.5 rounded">
            <div className="flex flex-col gap-0.5 w-3">
              <div className="h-0.5 w-full bg-[#1a3a1a]"></div>
              <div className="h-0.5 w-full bg-[#1a3a1a]"></div>
              <div className="h-0.5 w-full bg-[#1a3a1a]"></div>
            </div>
          </div>
          <span className="underline decoration-1 underline-offset-2 cursor-pointer hover:text-black">User</span>
          <span className="underline decoration-1 underline-offset-2 cursor-pointer hover:text-black">System</span>
          <span className="underline decoration-1 underline-offset-2 cursor-pointer hover:text-black">Help</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Monitor className="h-3.5 w-3.5" />
            <Settings className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1">
            <Minus className="h-4 w-4" />
            <Square className="h-3 w-3" />
            <X className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-[#e1f0e1] border-b border-[#c8d9c8] px-2 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleLogin()}
            disabled={isAuthenticating}
            className="p-1 hover:bg-[#d1e0d1] border border-transparent active:border-[#99aa99] rounded transition-colors disabled:opacity-50"
          >
            {isAuthenticating ? <Loader2 className="h-4 w-4 animate-spin text-emerald-700" /> : <Check className="h-4 w-4 text-emerald-700 font-bold" strokeWidth={3} />}
          </button>
          <div className="relative flex items-center bg-white border border-[#99aa99] h-6 px-1 w-32">
            <div className="flex-1 text-[11px] font-mono text-gray-500"></div>
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Main Login Area */}
      <main className="flex-1 relative pt-16 pl-16">
        <div className="max-w-md space-y-0.5 relative z-20">
          {/* User Row */}
          <div className="flex items-center group">
            <label className="w-24 text-[13px] text-gray-700">User</label>
            <div className="relative flex-1 max-w-[180px]">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                disabled={isAuthenticating}
                className="w-full bg-white border border-[#99aa99] h-6 px-1 focus:bg-[#fff9c4] focus:border-blue-500 outline-none shadow-inner"
              />
            </div>
          </div>
          <div className="h-px w-[320px] bg-gray-300 my-1"></div>

          {/* Password Row */}
          <div className="flex items-center group">
            <label className="w-24 text-[13px] text-gray-700">Password</label>
            <div className="relative flex-1 max-w-[180px]">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isAuthenticating}
                className="w-full bg-white border border-[#99aa99] h-6 px-1 focus:bg-[#fff9c4] focus:border-blue-500 outline-none shadow-inner tracking-widest leading-none pr-6"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="h-px w-[320px] bg-gray-300 my-1"></div>

          {/* Language & Login Button Row */}
          <div className="flex items-center group pt-2">
            <label className="w-24 text-[13px] text-gray-700">Logon Language</label>
            <div className="flex items-center gap-3">
              <div className="relative w-12">
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value.toUpperCase().slice(0, 2))}
                  className="w-full bg-white border border-[#99aa99] h-6 px-1 focus:bg-[#fff9c4] focus:border-blue-500 outline-none text-center font-bold"
                />
              </div>
              <button
                onClick={() => handleLogin()}
                disabled={isAuthenticating}
                className="px-4 h-6 flex items-center justify-center bg-gray-100 border border-[#99aa99] text-[13px] font-bold text-gray-700 hover:bg-white active:bg-gray-200 transition-colors shadow-sm disabled:opacity-50"
              >
                {isAuthenticating ? "Logging on..." : "Logon"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Status Bar */}
      <div className="bg-[#333e4f] h-8 flex items-center px-4 text-white text-xs border-t border-black/20">
        <div className="flex-1 flex items-center gap-4">
          <span className="opacity-80 font-bold tracking-wider">SIKKA LMC</span>
          <span className="opacity-80 font-mono">CLIENT 001 • SAP_GUI_WEB</span>
        </div>
        <div className="opacity-50 text-[10px] uppercase font-bold italic">Authenticated Secure Session</div>
      </div>
    </div>
  );
}


