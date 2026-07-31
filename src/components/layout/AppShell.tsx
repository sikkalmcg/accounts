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

// System Menu Components
import SystemMenu from "@/components/layout/SystemMenu";
import UserProfileDialog from "@/components/system/UserProfileDialog";
import ChangePasswordDialog from "@/components/system/ChangePasswordDialog";
import ThemeSettingsDialog from "@/components/system/ThemeSettingsDialog";
import SoundSettingsDialog from "@/components/system/SoundSettingsDialog";
import KeyboardShortcutsDialog from "@/components/system/KeyboardShortcutsDialog";

// System Hooks
import { useSounds, setGlobalSoundPlayer, playGlobalSound } from "@/hooks/use-sounds";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AppShellProps {
  children: React.ReactNode;
}

type ThemeType = 'classic' | 'gold' | 'dark' | 'belize' | 'green';
type StatusLevel = 'success' | 'error' | 'warning' | 'info';
type PendingAction = 'back' | 'exit' | 'cancel' | null;

const isDisplayModeForPath = (path: string) => {
  const code = path.split('/').pop()?.toUpperCase() || '';
  return code.endsWith('03') || Boolean(TCODE_MAP[code]?.isDisplayOnly);
};

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

  // Detailed theme id (matches ThemeSettingsDialog ids like 'quartz_dark')
  const [appliedThemeId, setAppliedThemeId] = useState<string | null>(null);

  const mapThemeIdToBase = (id: string | null): ThemeType => {
    if (!id) return 'classic';
    const lower = id.toLowerCase();
    if (lower.includes('dark') || lower.includes('hc_black') || lower.includes('hc')) return 'dark';
    if (lower.includes('belize')) return 'belize';
    if (lower.includes('gold')) return 'gold';
    if (lower.includes('green')) return 'green';
    return 'classic';
  };

  const applyThemeVars = (themeId: string | null) => {
    const map: Record<string, Record<string,string>> = {
      quartz_light: {
        '--background': '210 20% 96%',
        '--foreground': '222 47% 11%',
        '--card': '0 0% 100%',
        '--card-foreground': '222 47% 11%',
        '--primary': '217 67% 50%',
        '--primary-foreground': '210 40% 98%',
        '--secondary': '196 85% 68%',
        '--secondary-foreground': '222 47% 11%',
        '--accent': '196 85% 90%',
        '--accent-foreground': '222 47% 11%',
        '--border': '214.3 31.8% 91.4%',
        '--input': '214.3 31.8% 91.4%',
        '--ring': '217 67% 50%',
        '--sidebar-background': '0 0% 100%',
        '--sidebar-foreground': '222 47% 11%',
        '--sidebar-primary': '217 67% 50%',
        '--sidebar-primary-foreground': '210 40% 98%',
        '--sidebar-accent': '196 85% 90%',
        '--sidebar-accent-foreground': '222 47% 11%',
        '--sidebar-border': '214.3 31.8% 91.4%',
        '--sidebar-ring': '217 67% 50%',
      },
      quartz_dark: {
        '--background': '220 10% 6%',
        '--foreground': '210 40% 98%',
        '--card': '220 10% 12%',
        '--card-foreground': '210 40% 98%',
        '--primary': '193 85% 60%',
        '--primary-foreground': '210 40% 98%',
        '--secondary': '204 100% 78%',
        '--secondary-foreground': '210 40% 98%',
        '--accent': '144 60% 45%',
        '--accent-foreground': '210 40% 98%',
        '--border': '220 10% 25%',
        '--input': '220 10% 20%',
        '--ring': '193 85% 60%',
        '--sidebar-background': '220 10% 12%',
        '--sidebar-foreground': '210 40% 98%',
        '--sidebar-primary': '193 85% 60%',
        '--sidebar-primary-foreground': '210 40% 98%',
        '--sidebar-accent': '144 60% 45%',
        '--sidebar-accent-foreground': '210 40% 98%',
        '--sidebar-border': '220 10% 25%',
        '--sidebar-ring': '193 85% 60%',
      },
      belize: {
        '--background': '210 95% 98%',
        '--foreground': '222 47% 11%',
        '--card': '0 0% 100%',
        '--card-foreground': '222 47% 11%',
        '--primary': '205 60% 40%',
        '--primary-foreground': '210 40% 98%',
        '--secondary': '196 85% 68%',
        '--secondary-foreground': '222 47% 11%',
        '--accent': '18 100% 54%',
        '--accent-foreground': '210 40% 98%',
        '--border': '210 93% 89%',
        '--input': '210 93% 89%',
        '--ring': '205 60% 40%',
        '--sidebar-background': '210 95% 98%',
        '--sidebar-foreground': '222 47% 11%',
        '--sidebar-primary': '205 60% 40%',
        '--sidebar-primary-foreground': '210 40% 98%',
        '--sidebar-accent': '18 100% 54%',
        '--sidebar-accent-foreground': '210 40% 98%',
        '--sidebar-border': '210 93% 89%',
        '--sidebar-ring': '205 60% 40%',
      },
      classic: {
        '--background': '210 20% 96%',
        '--foreground': '222 47% 11%',
        '--card': '0 0% 100%',
        '--card-foreground': '222 47% 11%',
        '--primary': '217 67% 50%',
        '--primary-foreground': '210 40% 98%',
        '--secondary': '196 85% 68%',
        '--secondary-foreground': '222 47% 11%',
        '--accent': '196 85% 90%',
        '--accent-foreground': '222 47% 11%',
        '--border': '214.3 31.8% 91.4%',
        '--input': '214.3 31.8% 91.4%',
        '--ring': '217 67% 50%',
        '--sidebar-background': '0 0% 100%',
        '--sidebar-foreground': '222 47% 11%',
        '--sidebar-primary': '217 67% 50%',
        '--sidebar-primary-foreground': '210 40% 98%',
        '--sidebar-accent': '196 85% 90%',
        '--sidebar-accent-foreground': '222 47% 11%',
        '--sidebar-border': '214.3 31.8% 91.4%',
        '--sidebar-ring': '217 67% 50%',
      },
      sap_signature_hc: {
        '--background': '0 0% 0%',
        '--foreground': '0 0% 100%',
        '--card': '220 10% 12%',
        '--card-foreground': '0 0% 100%',
        '--primary': '210 60% 80%',
        '--primary-foreground': '0 0% 100%',
        '--secondary': '60 100% 70%',
        '--secondary-foreground': '0 0% 100%',
        '--accent': '60 100% 70%',
        '--accent-foreground': '0 0% 100%',
        '--border': '0 0% 100%',
        '--input': '220 10% 12%',
        '--ring': '210 60% 80%',
        '--sidebar-background': '220 10% 12%',
        '--sidebar-foreground': '0 0% 100%',
        '--sidebar-primary': '210 60% 80%',
        '--sidebar-primary-foreground': '0 0% 100%',
        '--sidebar-accent': '60 100% 70%',
        '--sidebar-accent-foreground': '0 0% 100%',
        '--sidebar-border': '0 0% 100%',
        '--sidebar-ring': '210 60% 80%',
      },
    };
    const vars = map[themeId || 'classic'] || map['classic'];
    const root = document.documentElement;
    Object.entries(vars).forEach(([k,v]) => root.style.setProperty(k, v));
    if (themeId && themeId.includes('dark')) root.classList.add('dark'); else root.classList.remove('dark');
  };

  const [isDirty, setIsDirty] = useState(false);
  const [hasSavedDocument, setHasSavedDocument] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [findCount, setFindCount] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(-1);
  const [recordCount, setRecordCount] = useState(0);
  const [saveInFlight, setSaveInFlight] = useState(false);

  // System Menu State
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // System Hooks
  const { settings: soundSettings, playSound } = useSounds();
  const { shortcuts: keyboardShortcuts, findShortcutByKey } = useKeyboardShortcuts();

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
    
    const savedTheme = localStorage.getItem("sikka_theme");
    if (savedTheme) {
      setAppliedThemeId(savedTheme);
      setCurrentTheme(mapThemeIdToBase(savedTheme));
      // apply CSS vars immediately
      try { applyThemeVars(savedTheme); } catch (e) {}
    }

    const storedRecent = localStorage.getItem("sikka_recent_tcodes");
    if (storedRecent) {
      try {
        setRecentTcodes(JSON.parse(storedRecent));
      } catch (e) {
        // ignore parse errors
      }
    }

    // Set global sound player for non-React contexts
    setGlobalSoundPlayer(playSound);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // The shell observes edits made by every t-code. This lets legacy and new
  // transactions receive SAP-style leave/cancel protection without each page
  // having to reimplement it.
  useEffect(() => {
    setIsDirty(false);
    setSelectedRecord(-1);
    setRecordCount(0);
    setHasSavedDocument(isDisplayModeForPath(pathname));
  }, [pathname]);

  useEffect(() => {
    const markDirty = (event: Event) => {
      const element = event.target as HTMLElement | null;
      if (element?.closest('main') && element.matches('input, textarea, select, button[role="checkbox"]')) {
        setIsDirty(true);
      }
    };
    const selectGridRecord = (event: MouseEvent) => {
      const row = (event.target as HTMLElement | null)?.closest('main tbody tr') as HTMLElement | null;
      if (!row) return;
      const rows = Array.from(document.querySelectorAll('main tbody tr')) as HTMLElement[];
      const index = rows.indexOf(row);
      if (index >= 0) {
        rows.forEach(item => item.classList.remove('ring-2', 'ring-inset', 'ring-blue-500', 'bg-blue-100'));
        row.classList.add('ring-2', 'ring-inset', 'ring-blue-500', 'bg-blue-100');
        setSelectedRecord(index);
        setRecordCount(rows.length);
      }
    };
    window.addEventListener('input', markDirty, true);
    window.addEventListener('change', markDirty, true);
    window.addEventListener('click', selectGridRecord, true);
    return () => {
      window.removeEventListener('input', markDirty, true);
      window.removeEventListener('change', markDirty, true);
      window.removeEventListener('click', selectGridRecord, true);
    };
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
        window.dispatchEvent(new CustomEvent('sap-toolbar-save'));
      } else if (e.key === 'F3') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sap-toolbar-back'));
      } else if (e.key === 'F12') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sap-toolbar-cancel'));
      }
      
      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('sap-toolbar-save'));
            break;
          case 'p':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('sap-toolbar-print'));
            break;
          case 'y':
            e.preventDefault();
            setIsBlockMode(prev => !prev);
            setStatusMessage({ text: isBlockMode ? "Block selection mode deactivated" : "Block selection mode active (Crosshair)", level: 'info' });
            break;
          case 'f':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('sap-toolbar-find'));
            break;
        }
      }

      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('sap-toolbar-cancel'));
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('sap-toolbar-back'));
      }
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        navigateRecord('next');
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
        if (saveInFlight && !e.detail.isError && e.detail.level !== 'error') {
          setIsDirty(false);
          setHasSavedDocument(true);
        }
        if (saveInFlight) setSaveInFlight(false);
        if (e.detail.level !== 'error' && !e.detail.isError) {
          setTimeout(() => setStatusMessage(null), 10000);
        }
      }
    };
    window.addEventListener('sap-status', handleStatus);
    return () => window.removeEventListener('sap-status', handleStatus);
  }, [saveInFlight]);

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

  const currentTcode = pathname.split('/').pop()?.toUpperCase() || "";
  const tcodeInfo = TCODE_MAP[currentTcode];
  const isHomePage = currentTcode === "DB01" || pathname === "/";
  const isDisplayMode = currentTcode.endsWith("03") || tcodeInfo?.isDisplayOnly;
  const hasPageAccess = isAdmin || isHomePage || userData?.tcodePermissions?.includes(currentTcode);
  const canSave = !isDisplayMode && userData?.permissions?.save !== false;
  const canPrint = userData?.permissions?.print !== false;

  const leaveTransaction = (action: Exclude<PendingAction, null>) => {
    if (action === 'cancel' || isDirty) {
      setPendingAction(action);
      return;
    }
    if (action === 'back') router.back();
    if (action === 'exit') router.push('/tcode/DB01');
  };

  const confirmPendingAction = () => {
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'cancel') {
      window.dispatchEvent(new CustomEvent('sap-cancel'));
      setIsDirty(false);
      setStatusMessage({ text: 'Transaction cancelled; unsaved data cleared', level: 'info' });
    } else if (action === 'back') {
      router.back();
    } else if (action === 'exit') {
      router.push('/tcode/DB01');
    }
  };

  const saveTransaction = () => {
    if (!canSave) {
      setStatusMessage({ text: 'You are not authorized to save this transaction', level: 'error' });
      return;
    }
    setSaveInFlight(true);
    window.dispatchEvent(new CustomEvent('sap-execute'));
  };

  const printTransaction = () => {
    if (!canPrint) {
      setStatusMessage({ text: 'You are not authorized to print this transaction', level: 'error' });
      return;
    }
    if (!hasSavedDocument) {
      setStatusMessage({ text: 'Save the document before printing', level: 'warning' });
      return;
    }
    window.print();
  };

  const runFind = () => {
    const term = findText.trim().toLowerCase();
    const targets = Array.from(document.querySelectorAll('main td, main [role="gridcell"], main input, main textarea')) as HTMLElement[];
    targets.forEach(target => target.classList.remove('bg-yellow-200', 'ring-1', 'ring-amber-400'));
    if (!term) {
      setFindCount(0);
      return;
    }
    const matches = targets.filter(target => {
      const value = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : target.textContent || '';
      return value.toLowerCase().includes(term);
    });
    matches.forEach(target => target.classList.add('bg-yellow-200', 'ring-1', 'ring-amber-400'));
    matches[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFindCount(matches.length);
    window.dispatchEvent(new CustomEvent('sap-find', { detail: { term } }));
  };

  const navigateRecord = (direction: 'first' | 'previous' | 'next' | 'last') => {
    const rows = Array.from(document.querySelectorAll('main tbody tr')) as HTMLElement[];
    if (!rows.length) return;
    const current = selectedRecord < 0 ? 0 : selectedRecord;
    const target = direction === 'first' ? 0 : direction === 'last' ? rows.length - 1 : direction === 'previous' ? Math.max(0, current - 1) : Math.min(rows.length - 1, current + 1);
    rows.forEach(row => row.classList.remove('ring-2', 'ring-inset', 'ring-primary', 'bg-primary/10'));
    rows[target].classList.add('ring-2', 'ring-inset', 'ring-primary', 'bg-primary/10');
    rows[target].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setSelectedRecord(target);
    setRecordCount(rows.length);
    window.dispatchEvent(new CustomEvent('sap-record-navigation', { detail: { direction, index: target } }));
  };

  useEffect(() => {
    const save = () => saveTransaction();
    const back = () => leaveTransaction('back');
    const cancel = () => leaveTransaction('cancel');
    const print = () => printTransaction();
    const find = () => setFindOpen(true);
    window.addEventListener('sap-toolbar-save', save);
    window.addEventListener('sap-toolbar-back', back);
    window.addEventListener('sap-toolbar-cancel', cancel);
    window.addEventListener('sap-toolbar-print', print);
    window.addEventListener('sap-toolbar-find', find);
    return () => {
      window.removeEventListener('sap-toolbar-save', save);
      window.removeEventListener('sap-toolbar-back', back);
      window.removeEventListener('sap-toolbar-cancel', cancel);
      window.removeEventListener('sap-toolbar-print', print);
      window.removeEventListener('sap-toolbar-find', find);
    };
  }, [canPrint, canSave, hasSavedDocument, isDirty, router]);

  if (pathname === "/login") return <>{children}</>;

  const isWaitingForDatabase = false;
  
  if (isUserLoading || isWaitingForDatabase || !hasMounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
          CONNECTING TO SIKKA ACCOUNT MANAGEMENT SYSTEM
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={400}>
      <div className={cn(
        "flex flex-col min-h-screen w-full font-sans text-sm select-none bg-background text-foreground",
        isBlockMode && "sap-block-mode"
      )}>
        {/* SAP Top Menu Bar with Window Controls */}
        <div className={cn("border-b px-2 py-0.5 flex items-center justify-between text-[13px] bg-card border-border text-foreground")}> 
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 cursor-default hover:bg-primary/10 px-2 py-0.5 rounded">
              <Monitor className="h-4 w-4 text-primary" />
            </div>
{["Menu", "Edit", "Favorites", "Extras"].map((item) => (
              <span key={item} className="cursor-default hover:bg-primary/10 px-2 py-0.5 rounded transition-colors text-foreground">{item}</span>
            ))}
            <div className="relative">
              <span 
                onClick={() => { setSystemMenuOpen(!systemMenuOpen); if (!systemMenuOpen) playGlobalSound('button_click'); }}
                className="cursor-default hover:bg-primary/10 px-2 py-0.5 rounded transition-colors inline-block text-foreground"
              >
                System
              </span>
              <SystemMenu
                isOpen={systemMenuOpen}
                onClose={() => setSystemMenuOpen(false)}
                onOpenProfile={() => setShowUserProfile(true)}
                onOpenChangePassword={() => setShowChangePassword(true)}
                onOpenThemeSettings={() => setShowThemeSettings(true)}
                onOpenSoundSettings={() => setShowSoundSettings(true)}
                onOpenKeyboardShortcuts={() => setShowKeyboardShortcuts(true)}
                onLogout={handleLogout}
                onAbout={() => {
                  window.dispatchEvent(new CustomEvent('sap-status', {
                    detail: { text: 'SIKKA LMC - Smart Accounting Platform v1.0.0', level: 'info' },
                  }));
                }}
              />
            </div>
            <span className="cursor-default hover:bg-primary/10 px-2 py-0.5 rounded transition-colors text-foreground">Help</span>
          </div>

          {/* RIGHT SIDE: Standard Window Controls */}
          <div className="flex items-center">
            <div className="flex items-center">
              <button 
                onClick={handleMinimize}
                className="p-1.5 hover:bg-primary/10 transition-colors text-foreground/70"
                title="Minimize (Go to Home)"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={handleMaximize}
                className="p-1.5 hover:bg-primary/10 transition-colors text-foreground/70"
                title={isFullscreen ? "Restore" : "Maximize"}
              >
                {isFullscreen ? <Maximize2 className="h-3 w-3" /> : <Square className="h-3 w-3" />}
              </button>
              <button 
                onClick={handleLogout}
                className="p-1.5 hover:bg-destructive hover:text-white transition-colors text-foreground/70"
                title="Close (Log Off)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Standard Toolbar */}
        <div className="border-b px-2 py-1 flex items-center justify-between shadow-inner h-9 bg-card border-border text-foreground">
          <div className="flex items-center gap-0.5">
            <Tooltip><TooltipTrigger asChild><button onClick={() => handleTcodeSubmit()} className="p-1 hover:bg-muted/80 rounded transition-colors"><Check className="h-4 w-4 text-primary font-bold" strokeWidth={3} /></button></TooltipTrigger><TooltipContent>Enter</TooltipContent></Tooltip>
            
            <div className="relative flex items-center bg-card border border-border h-6 w-44 ml-1 group focus-within:border-primary">
              <input 
                ref={inputRef}
                value={tcode} 
                onChange={(e) => setTcode(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleTcodeSubmit()} 
                className="w-full h-full px-1 text-xs font-mono uppercase outline-none text-foreground bg-card disabled:bg-muted" 
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button className="h-full px-1 hover:bg-muted border-l border-border transition-colors flex items-center"><ChevronRight className="h-3 w-3 text-muted-foreground" /></button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-0 rounded-none border-border bg-card z-[110]" align="start" sideOffset={1}>
                  <div className="flex flex-col max-h-64 overflow-y-auto no-scrollbar">
                    {recentTcodes.length > 0 ? recentTcodes.map((code) => (
                      <button key={code} onClick={() => handleTcodeSubmit(code)} className="text-left px-3 py-1.5 text-xs font-mono hover:bg-primary hover:text-white border-b border-border transition-colors">{code}</button>
                    )) : <div className="p-3 text-[10px] text-muted-foreground italic">No recent commands</div>}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="w-px h-6 bg-border mx-2" />
            
            {/* Execute Button - Only show if NOT on DB01 */}
            {!isHomePage && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('sap-execute'))} 
                      className="p-1 hover:bg-muted/80 rounded text-primary"
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
                          className="p-1 hover:bg-muted/80 rounded text-primary"
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
                          className="p-1 hover:bg-muted/80 rounded text-primary"
                        >
                          <LayoutList className="h-[18px] w-[18px]" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Select Layout</TooltipContent>
                    </Tooltip>
                  </>
                )}

                <div className="w-px h-6 bg-border mx-2" />
              </>
            )}

            <Tooltip><TooltipTrigger asChild><button onClick={saveTransaction} disabled={!canSave} className="p-1 hover:bg-muted/80 rounded text-primary disabled:opacity-35"><Save className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Save (Ctrl+S)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button onClick={() => leaveTransaction('back')} className="p-1 hover:bg-muted/80 rounded text-primary"><ArrowLeft className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Back (Alt+Left)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button onClick={() => leaveTransaction('exit')} className="p-1 hover:bg-muted/80 rounded text-primary"><LogOut className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Exit to Dashboard</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button onClick={() => leaveTransaction('cancel')} className="p-1 hover:bg-muted/80 rounded text-destructive"><XCircle className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Cancel (Esc)</TooltipContent></Tooltip>
            
            <div className="w-px h-6 bg-border mx-2" />
            
            <Tooltip><TooltipTrigger asChild><button onClick={printTransaction} disabled={!canPrint} className="p-1 hover:bg-muted/80 rounded text-foreground disabled:opacity-35"><Printer className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Print saved document (Ctrl+P)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button onClick={() => setFindOpen(true)} className="p-1 hover:bg-muted/80 rounded text-foreground"><Search className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Find (Ctrl+F)</TooltipContent></Tooltip>
            
            <div className="w-px h-6 bg-border mx-2" />
            
            <div className="flex items-center gap-0.5">
              <Tooltip><TooltipTrigger asChild><button onClick={() => navigateRecord('first')} disabled={selectedRecord <= 0} className="p-1 hover:bg-muted/80 rounded disabled:opacity-30 text-foreground"><ChevronFirst className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>First Record</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><button onClick={() => navigateRecord('previous')} disabled={selectedRecord <= 0} className="p-1 hover:bg-muted/80 rounded disabled:opacity-30 text-foreground"><ChevronLeft className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Previous Record</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><button onClick={() => navigateRecord('next')} disabled={selectedRecord < 0 || selectedRecord >= recordCount - 1} className="p-1 hover:bg-muted/80 rounded disabled:opacity-30 text-foreground"><ChevronRight className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Next Record (Alt+Right)</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><button onClick={() => navigateRecord('last')} disabled={selectedRecord < 0 || selectedRecord >= recordCount - 1} className="p-1 hover:bg-muted/80 rounded disabled:opacity-30 text-foreground"><ChevronLast className="h-4 w-4" /></button></TooltipTrigger><TooltipContent>Last Record</TooltipContent></Tooltip>
            </div>

            <div className="w-px h-6 bg-border mx-2" />
            <Tooltip><TooltipTrigger asChild><button onClick={() => window.open(window.location.href, '_blank')} className="p-1 hover:bg-muted/80 rounded text-primary"><ExternalLink className="h-[18px] w-[18px]" /></button></TooltipTrigger><TooltipContent>Create New Session (Ctrl+N)</TooltipContent></Tooltip>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end leading-tight">
              <div className="text-[11px] font-bold uppercase">{userData?.name || "GUEST"}</div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-bold hover:text-primary transition-colors bg-card/50 px-2 py-1 border border-border shadow-sm rounded-sm">
              <LogOut className="h-3.5 w-3.5" />
              <span>LOG OFF</span>
            </button>
          </div>
        </div>

        {/* Main Workspace */}
        <main className="flex-1 w-full overflow-auto flex flex-col transition-all duration-300 bg-background text-foreground">
          {hasPageAccess ? children : (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-6">
              <div className="bg-destructive/10 p-8 rounded-full border-2 border-destructive/40 animate-in zoom-in-75">
                <ShieldAlert className="h-16 w-16 text-destructive" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-destructive/90 uppercase italic">Authorization Failure</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto font-medium">
                  You are not authorized for transaction <b className="text-destructive">{currentTcode}</b>. 
                  Contact system owner (SU01) for Plant access permissions.
                </p>
              </div>
              <Button onClick={() => router.push("/tcode/DB01")} variant="outline" className="rounded-none border-border font-bold uppercase px-8 hover:bg-muted shadow-md transition-all">Return to Home</Button>
            </div>
          )}
        </main>

        <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
          <AlertDialogContent className="max-w-md rounded-sm border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingAction === 'cancel' ? 'Cancel transaction?' : 'Unsaved changes'}</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingAction === 'cancel'
                  ? 'Are you sure you want to cancel this transaction? All unsaved data will be cleared.'
                  : 'You have unsaved changes. Do you want to leave this page?'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>No</AlertDialogCancel>
              <AlertDialogAction onClick={confirmPendingAction}>Yes</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={findOpen} onOpenChange={setFindOpen}>
          <AlertDialogContent className="max-w-md rounded-sm border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Find in current screen</AlertDialogTitle>
              <AlertDialogDescription>Searches all visible fields and grid values, including document number, customer, vendor, plant, material, employee, and transporter.</AlertDialogDescription>
            </AlertDialogHeader>
            <input autoFocus value={findText} onChange={(e) => setFindText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runFind()} placeholder="Enter search text" className="h-9 w-full border border-border px-2 text-sm outline-none focus:border-primary" />
            {findText && <p className="text-xs text-muted-foreground">{findCount} matching field{findCount === 1 ? '' : 's'} highlighted</p>}
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <AlertDialogAction onClick={runFind}>Find</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

{/* System Menu Dialogs */}
        {userData && (
          <>
            <UserProfileDialog
              open={showUserProfile}
              onOpenChange={setShowUserProfile}
              userData={userData}
              onSave={(updatedUser) => {
                setUserData(updatedUser);
                localStorage.setItem("sikka_user", JSON.stringify(updatedUser));
              }}
            />
            <ChangePasswordDialog
              open={showChangePassword}
              onOpenChange={setShowChangePassword}
              userData={userData}
            />
            <ThemeSettingsDialog
              open={showThemeSettings}
              onOpenChange={setShowThemeSettings}
              currentTheme={appliedThemeId || currentTheme}
              onApplyTheme={(theme) => { setAppliedThemeId(theme); setCurrentTheme(mapThemeIdToBase(theme)); applyThemeVars(theme); }}
              userData={userData}
            />
            <SoundSettingsDialog
              open={showSoundSettings}
              onOpenChange={setShowSoundSettings}
              userData={userData}
            />
            <KeyboardShortcutsDialog
              open={showKeyboardShortcuts}
              onOpenChange={setShowKeyboardShortcuts}
              userData={userData}
            />
          </>
        )}

        {/* SAP Status Bar */}
        <div className={cn(
          "h-7 w-full flex items-center px-4 text-white text-[11px] border-t border-black/20 transition-all duration-300 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]",
          statusMessage?.level === 'error' ? "bg-red-700" : 
          statusMessage?.level === 'warning' ? "bg-amber-600" :
          statusMessage?.level === 'info' ? "bg-blue-700" :
          statusMessage?.level === 'success' ? "bg-emerald-700" : 
          "bg-border"
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
                <span className="text-muted-foreground">INS (1) 001</span>
              </div>
            )}
          </div>
          {isBlockMode && <div className="text-[9px] font-black bg-card text-foreground px-2 py-0.5 rounded-sm animate-pulse mr-4">BLOCK MODE</div>}
        </div>
      </div>
    </TooltipProvider>
  );
}
