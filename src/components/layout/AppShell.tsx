"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  LogOut, 
  Check, 
  Save, 
  ArrowLeft, 
  X, 
  ChevronRight,
  Monitor,
  Printer,
  Search,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ExternalLink,
  PlusCircle,
  FileEdit,
  Trash2,
  XCircle,
  Cpu,
  Loader2,
  Play,
  ShieldAlert,
  Info,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  LayoutGrid,
  LayoutList,
  Minus,
  Square,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TCODE_MAP } from "@/lib/tcode-registry";
import { useUser, useAuth, initiateAnonymousSignIn } from "@/database";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AppShellProps {
  children: React.ReactNode;
}

type ThemeType = 'classic' | 'gold' | 'dark' | 'belize' | 'green';
type StatusLevel = 'success' | 'error' | 'warning' | 'info';

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const [tcode, setTcode] = useState("");
  const [recentTcodes, setRecentTcodes] = useState<string[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('classic');
  const [statusMessage, setStatusMessage] = useState<{ text: string; level: StatusLevel } | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isBlockMode, setIsBlockMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userData?.role === 'admin' || userData?.username === "ajaysomra";

  useEffect(() => {
    const stored = localStorage.getItem("sikka_user");
    
    if (!stored && pathname !== "/login") {
      router.push("/login");
      return;
    } else if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUserData(parsed);
      } catch (e) {
        // ignore parse errors
      }
      if (!user && !isUserLoading) {
        initiateAnonymousSignIn(auth);
      }
    }
    
    const savedTheme = localStorage.getItem("sikka_theme") as ThemeType;
    if (savedTheme) setCurrentTheme(savedTheme);

    const storedRecent = localStorage.getItem("sikka_recent_tcodes");
    if (storedRecent) {
      try {
        setRecentTcodes(JSON.parse(storedRecent));
      } catch (e) {
        // ignore parse errors
      }
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleTcodeSubmit = useCallback((inputOverride?: string) => {
    const command = (inputOverride || tcode).trim().toUpperCase();
    if (!command) return;

    setStatusMessage(null);

    let targetCode = command;
    let isNewWindow = false;

    if (command === "/N") {
      targetCode = "DB01";
    } else if (command.startsWith("/N")) {
      targetCode = command.substring(2);
    } else if (command.startsWith("/O")) {
      targetCode = command.substring(2);
      isNewWindow = true;
    }

    if (targetCode && !TCODE_MAP[targetCode]) {
      setStatusMessage({ text: `Transaction ${targetCode} does not exist`, level: 'error' });
      return;
    }

    if (targetCode && !isAdmin && !userData?.tcodePermissions?.includes(targetCode)) {
      setStatusMessage({ text: `No authorization for transaction ${targetCode}`, level: 'error' });
      return;
    }

    setRecentTcodes(prev => {
      const updated = [command, ...prev.filter(c => c !== command)].slice(0, 10);
      localStorage.setItem("sikka_recent_tcodes", JSON.stringify(updated));
      return updated;
    });

    if (isNewWindow) {
      window.open(`${window.location.origin}/tcode/${targetCode}`, '_blank');
    } else {
      router.push(`/tcode/${targetCode}`);
    }
    
    setTcode("");
    setStatusMessage(null);

  }, [tcode, router, isAdmin, userData]);

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sap-execute'));
      } else if (e.key === 'F3') {
        e.preventDefault();
        router.push("/tcode/DB01");
      } else if (e.key === 'F12') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sap-cancel'));
      }
      
      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('sap-execute'));
            break;
          case 'p':
            e.preventDefault();
            window.print();
            break;
          case 'y':
            e.preventDefault();
            setIsBlockMode(prev => !prev);
            setStatusMessage({ text: isBlockMode ? "Block selection mode deactivated" : "Block selection mode active (Crosshair)", level: 'info' });
            break;
          case 'f':
            e.preventDefault();
            inputRef.current?.focus();
            break;
        }
      }

      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('sap-cancel'));
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [router, isBlockMode]);

  useEffect(() => {
    const handleStatus = (e: any) => {
      if (e.detail) {
        setStatusMessage({
          text: e.detail.text,
          level: e.detail.isError ? 'error' : (e.detail.level || 'success')
        });
        if (e.detail.level !== 'error' && !e.detail.isError) {
          setTimeout(() => setStatusMessage(null), 10000);
        }
      }
    };
    window.addEventListener('sap-status', handleStatus);
    return () => window.removeEventListener('sap-status', handleStatus);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("sikka_user");
    router.push("/login");
  };

  const handleMinimize = () => {
    router.push("/tcode/DB01");
    setStatusMessage({ text: "Window Minimized to Home", level: 'info' });
  };

  const handleMaximize = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  if (pathname === "/login") return <>{children}</>;

  const isWaitingForDatabase = false;
  
  if (isUserLoading || isWaitingForDatabase || !hasMounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f0f0f0] space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest animate-pulse">
          CONNECTING TO SIKKA ACCOUNT MANAGEMENT SYSTEM
        </div>
      </div>
    );
  }

  const currentTcode = pathname.split('/').pop()?.toUpperCase() || "";
  const tcodeInfo = TCODE_MAP[currentTcode];
  const isHomePage = currentTcode === "DB01" || pathname === "/";
  const isDisplayMode = currentTcode.endsWith("03") || tcodeInfo?.isDisplayOnly;
  const hasPageAccess = isAdmin || isHomePage || userData?.tcodePermissions?.includes(currentTcode);

  const themeStyles = {
    classic: { standardToolbar: "bg-[#e1e1e1] border-gray-400", appToolbar: "bg-gradient-to-b from-[#dae8f5] to-[#c7d9ed]", main: "bg-white", status: "bg-[#333e4f]" },
    gold: { standardToolbar: "bg-[#f2ead3] border-[#d4c5a0]", appToolbar: "bg-gradient-to-b from-[#fdf8e6] to-[#f5ecd1]", main: "bg-[#fdfcf7]", status: "bg-[#5c4a1e]" },
    green: { standardToolbar: "bg-[#e2f0e2] border-[#b8ccb8]", appToolbar: "bg-gradient-to-b from-[#f0faf0] to-[#d8ebd8]", main: "bg-[#f7fcf7]", status: "bg-[#2d4d2d]" },
    belize: { standardToolbar: "bg-[#eef5fa] border-[#cfe1f0]", appToolbar: "bg-gradient-to-b from-[#f3f9ff] to-[#e1effc]", main: "bg-white", status: "bg-[#005a8e]" },
    dark: { standardToolbar: "bg-[#3d3d3d] border-gray-600", appToolbar: "bg-gradient-to-b from-[#3d3d3d] to-[#2d2d2d]", main: "bg-[#121212] text-gray-200", status: "bg-black" }
  }[currentTheme];

  return (
    <TooltipProvider delayDuration={400}>
      <div className={cn(
        "flex flex-col min-h-screen w-full font-sans text-sm select-none", 
        currentTheme === 'dark' ? "bg-[#1a1a1a] text-gray-200" : "bg-[#f0f0f0] text-gray-800",
        isBlockMode && "sap-block-mode"
      )}>
        {/* SAP Top Menu Bar with Window Controls */}
        <div className={cn("border-b px-2 py-0.5 flex items-center justify-between text-[13px]", currentTheme === 'dark' ? "bg-[#2d2d2d] border-gray-700 text-gray-300" : "bg-[#f0f0f0] border-gray-300 text-gray-800")}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 cursor-default hover:bg-blue-100 px-2 py-0.5 rounded">
              <Monitor className="h-4 w-4 text-blue-600" />
            </div>
            {["Menu", "Edit", "Favorites", "Extras", "System", "Help"].map((item) => (
              <span key={item} className="cursor-default hover:bg-blue-100/50 px-2 py-0.5 rounded transition-colors">{item}</span>
            ))}
          </div>

          {/* RIGHT SIDE: Standard Window Controls */}
          <div className="flex items-center">
            <div className="flex items-center">
              <button 
                onClick={handleMinimize}
                className="p-1.5 hover:bg-gray-200 transition-colors text-gray-600"
                title="Minimize (Go to Home)"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={handleMaximize}
                className="p-1.5 hover:bg-gray-200 transition-colors text-gray-600"
                title={isFullscreen ? "Restore" : "Maximize"}
              >
                {isFullscreen ? <Maximize2 className="h-3 w-3" /> : <Square className="h-3 w-3" />}
              </button>
              <button 
                onClick={handleLogout}
                className="p-1.5 hover:bg-red-500 hover:text-white transition-colors text-gray-600"
                title="Close (Log Off)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Standard Toolbar */}
        <div className={cn("border-b px-2 py-1 flex items-center justify-between shadow-inner h-9", themeStyles.standardToolbar)}>
          <div className="flex items-center gap-0.5">
            <Tooltip><TooltipTrigger asChild><button onClick={() => handleTcodeSubmit()} className="p-1 hover:bg-black/10 rounded transition-colors"><Check className="h-4 w-4 text-emerald-700 font-bold" strokeWidth={3} /></button></TooltipTrigger><TooltipContent>Enter</TooltipContent></Tooltip>
            
            <div className="relative flex items-center bg-white border border-gray-400 h-6 w-44 ml-1 group focus-within:border-blue-500">
              <input 
                ref={inputRef}
                value={tcode} 
                onChange={(e) => setTcode(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleTcodeSubmit()} 
                className="w-full h-full px-1 text-xs font-mono uppercase outline-none text-black disabled:bg-gray-100" 
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-full px-1 hover:bg-gray-100 border-l border-gray-300 transition-colors flex items-center"><ChevronRight className="h-3 w-3 text-gray-400" /></button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-0 rounded-none border-gray-400 bg-white z-[110]" align="start" sideOffset={1}>
                  <div className="flex flex-col max-h-64 overflow-y-auto no-scrollbar">
                    {recentTcodes.length > 0 ? recentTcodes.map((code) => (
                      <button key={code} onClick={() => handleTcodeSubmit(code)} className="text-left px-3 py-1.5 text-xs font-mono hover:bg-blue-600 hover:text-white border-b border-gray-50 transition-colors">{code}</button>
                    )) : <div className="p-3 text-[10px] text-gray-400 italic">No recent commands</div>}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="w-px h-6 bg-gray-400 mx-2" />
            
            {/* Execute Button - Only show if NOT on DB01 */}
            {!isHomePage && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('sap-execute'))} 
                      className="p-1 hover:bg-black/10 rounded text-emerald-700"
                    >
                      <Play className="h-[18px] w-[18px] fill-current" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Execute (F8)</TooltipContent>
                </Tooltip>
                
                {/* Change Layout Button - Only show on ZINV */}
                {currentTcode === "ZINV" && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => window.dispatchEvent(new CustomEvent('sap-change-layout'))} 
                          className="p-1 hover:bg-black/10 rounded text-blue-700"
                        >
                          <LayoutGrid className="h-[18px] w-[18px]" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Change Layout</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => window.dispatchEvent(new CustomEvent('sap-select-layout'))} 
                          className="p-1 hover:bg-black/10 rounded text-blue-700"
                        >
                          <LayoutList className="h-[18px] w-[18px]" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Select Layout</TooltipContent>
                    </Tooltip>
                  </>
                )}

                <div className="w-px h-6 bg-gray-400 mx-2" />
              </>
            )}

            <Tooltip><TooltipTrigger asChild><button onClick={() => window.dispatchEvent(new CustomEvent('sap-execute'))} className="p-1 hover:bg-black/10 rounded text-blue-700"><Save className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Save (Ctrl+S)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button onClick={() => router.push("/tcode/DB01")} className="p-1 hover:bg-black/10 rounded text-emerald-700"><ArrowLeft className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Back (F3)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button onClick={() => router.push("/tcode/DB01")} className="p-1 hover:bg-black/10 rounded text-amber-700"><LogOut className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Exit (Shift+F3)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button onClick={() => window.dispatchEvent(new CustomEvent('sap-cancel'))} className="p-1 hover:bg-black/10 rounded text-red-600"><XCircle className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Cancel (F12)</TooltipContent></Tooltip>
            
            <div className="w-px h-6 bg-gray-400 mx-2" />
            
            <Tooltip><TooltipTrigger asChild><button onClick={() => window.print()} className="p-1 hover:bg-black/10 rounded text-gray-700"><Printer className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Print (Ctrl+P)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button onClick={() => {}} className="p-1 hover:bg-black/10 rounded text-gray-700"><Search className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Find (Ctrl+F)</TooltipContent></Tooltip>
            
            <div className="w-px h-6 bg-gray-400 mx-2" />
            
            <div className="flex items-center gap-0.5 opacity-60">
              <button className="p-1 hover:bg-black/10 rounded"><ChevronFirst className="h-4 w-4" /></button>
              <button className="p-1 hover:bg-black/10 rounded"><ChevronLeft className="h-4 w-4" /></button>
              <button className="p-1 hover:bg-black/10 rounded"><ChevronRight className="h-4 w-4" /></button>
              <button className="p-1 hover:bg-black/10 rounded"><ChevronLast className="h-4 w-4" /></button>
            </div>

            <div className="w-px h-6 bg-gray-400 mx-2" />
            <Tooltip><TooltipTrigger asChild><button onClick={() => window.open(window.location.href, '_blank')} className="p-1 hover:bg-black/10 rounded text-blue-600"><ExternalLink className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Create New Session (Ctrl+N)</TooltipContent></Tooltip>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end leading-tight">
              <div className="text-[11px] font-bold uppercase">{userData?.name || "GUEST"}</div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-bold hover:text-blue-700 transition-colors bg-white/50 px-2 py-1 border border-gray-300 shadow-sm rounded-sm">
              <LogOut className="h-3.5 w-3.5" />
              <span>LOG OFF</span>
            </button>
          </div>
        </div>

        {/* Main Workspace */}
        <main className={cn("flex-1 w-full overflow-auto flex flex-col transition-all duration-300", themeStyles.main)}>
          {hasPageAccess ? children : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-6">
              <div className="bg-red-50 p-8 rounded-full border-2 border-red-200 animate-in zoom-in-75">
                <ShieldAlert className="h-16 w-16 text-red-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-red-800 uppercase italic">Authorization Failure</h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto font-medium">
                  You are not authorized for transaction <b className="text-red-700">{currentTcode}</b>. 
                  Contact system owner (SU01) for Plant access permissions.
                </p>
              </div>
              <Button onClick={() => router.push("/tcode/DB01")} variant="outline" className="rounded-none border-gray-400 font-bold uppercase px-8 hover:bg-gray-100 shadow-md transition-all">Return to Home</Button>
            </div>
          )}
        </main>

        {/* SAP Status Bar */}
        <div className={cn(
          "h-7 w-full flex items-center px-4 text-white text-[11px] border-t border-black/20 transition-all duration-300 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]",
          statusMessage?.level === 'error' ? "bg-red-700" : 
          statusMessage?.level === 'warning' ? "bg-amber-600" :
          statusMessage?.level === 'info' ? "bg-blue-700" :
          statusMessage?.level === 'success' ? "bg-emerald-700" : 
          themeStyles.status
        )}>
          <div className="flex-1 flex items-center gap-4 uppercase tracking-tighter font-black overflow-hidden">
            {statusMessage ? (
              <div className="flex items-center gap-2 animate-in slide-in-from-left-4 duration-300 whitespace-nowrap">
                {statusMessage.level === 'error' && <XCircle className="h-3.5 w-3.5 fill-white text-red-700" />}
                {statusMessage.level === 'warning' && <AlertTriangle className="h-3.5 w-3.5 fill-white text-amber-600" />}
                {statusMessage.level === 'success' && <CheckCircle2 className="h-3.5 w-3.5 fill-white text-emerald-700" />}
                {statusMessage.level === 'info' && <Info className="h-3.5 w-3.5 fill-white text-blue-700" />}
                <span>{statusMessage.text}</span>
              </div>
            ) : (
              <div className="flex items-center gap-4 animate-in fade-in duration-500">
                <span className="flex items-center gap-1.5"><CircleDashed className="h-3 w-3 animate-spin opacity-40" /> {isDisplayMode ? `DISPLAY • ${currentTcode}` : (pathname.includes('/tcode/') ? currentTcode : 'READY')}</span>
                <span className="opacity-30">|</span>
                <span>SIKKA ERP KERNEL 7.70</span>
                <span className="opacity-30">|</span>
                <span className="text-gray-400">INS (1) 001</span>
              </div>
            )}
          </div>
          {isBlockMode && <div className="text-[9px] font-black bg-white text-black px-2 py-0.5 rounded-sm animate-pulse mr-4">BLOCK MODE</div>}
        </div>
      </div>
    </TooltipProvider>
  );
}


