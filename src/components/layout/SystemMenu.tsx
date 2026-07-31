"use client";

import { useState, useRef, useEffect } from "react";
import {
  User,
  KeyRound,
  Palette,
  Volume2,
  Keyboard,
  LogOut,
  Info,
  ChevronRight,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSounds, playGlobalSound } from "@/hooks/use-sounds";

interface SystemMenuProps {
  onOpenProfile: () => void;
  onOpenChangePassword: () => void;
  onOpenThemeSettings: () => void;
  onOpenSoundSettings: () => void;
  onOpenKeyboardShortcuts: () => void;
  onLogout: () => void;
  onAbout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function SystemMenu({
  onOpenProfile,
  onOpenChangePassword,
  onOpenThemeSettings,
  onOpenSoundSettings,
  onOpenKeyboardShortcuts,
  onLogout,
  onAbout,
  isOpen,
  onClose,
}: SystemMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
        setActiveSubmenu(null);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeSubmenu) {
          setActiveSubmenu(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, activeSubmenu]);

  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'profile',
      label: 'User Profile',
      icon: User,
      shortcut: 'F5',
      onClick: () => { onOpenProfile(); onClose(); playGlobalSound('button_click'); },
    },
    {
      id: 'change_password',
      label: 'Change Password',
      icon: KeyRound,
      shortcut: 'Ctrl+Shift+P',
      onClick: () => { onOpenChangePassword(); onClose(); playGlobalSound('button_click'); },
    },
    { type: 'separator' as const },
    {
      id: 'theme',
      label: 'Theme Settings',
      icon: Palette,
      shortcut: '',
      onClick: () => { onOpenThemeSettings(); onClose(); playGlobalSound('button_click'); },
    },
    {
      id: 'sound',
      label: 'Sound Settings',
      icon: Volume2,
      shortcut: '',
      onClick: () => { onOpenSoundSettings(); onClose(); playGlobalSound('button_click'); },
    },
    {
      id: 'keyboard',
      label: 'Keyboard Shortcuts',
      icon: Keyboard,
      shortcut: '',
      onClick: () => { onOpenKeyboardShortcuts(); onClose(); playGlobalSound('button_click'); },
    },
    { type: 'separator' as const },
    {
      id: 'logout',
      label: 'Log Off',
      icon: LogOut,
      shortcut: '',
      onClick: () => { onLogout(); onClose(); },
      danger: true,
    },
    { type: 'separator' as const },
    {
      id: 'about',
      label: 'About SIKKA LMC',
      icon: Info,
      shortcut: '',
      onClick: () => { onAbout(); onClose(); },
    },
  ];

  return (
    <div
      ref={menuRef}
      className="absolute left-0 top-full z-[200] min-w-[240px] bg-white border border-gray-300 shadow-lg shadow-black/20"
      style={{ 
        boxShadow: '2px 2px 6px rgba(0,0,0,0.15)',
      }}
    >
      <div className="py-0.5">
        {menuItems.map((item, index) => {
          if ('type' in item && item.type === 'separator') {
            return <div key={index} className="border-t border-gray-200 my-1" />;
          }

          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-1.5 text-[12px] text-left hover:bg-blue-600 hover:text-white transition-colors group",
                item.danger && "text-red-700 hover:bg-red-600 hover:text-white"
              )}
            >
              <Icon className={cn(
                "h-4 w-4 shrink-0",
                item.danger ? "text-red-500 group-hover:text-white" : "text-gray-500 group-hover:text-white"
              )} />
              <span className="flex-1 font-medium">{item.label}</span>
              {item.shortcut && (
                <span className="text-[10px] text-gray-400 group-hover:text-blue-200 font-mono">
                  {item.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SAP-style footer */}
      <div className="bg-[#e7ebf1] border-t border-gray-300 px-4 py-1 text-[9px] text-gray-500 font-bold uppercase tracking-wider">
        System Settings • User Specific
      </div>
    </div>
  );
}
