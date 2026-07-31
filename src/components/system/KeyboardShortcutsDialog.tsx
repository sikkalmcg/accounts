"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Keyboard,
  Loader2,
  CheckCircle2,
  Search,
  RotateCcw,
  Lock,
  AlertCircle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  MousePointerClick,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardShortcuts, ShortcutDef, DEFAULT_SHORTCUTS } from "@/hooks/use-keyboard-shortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userData: any;
}

const MODIFIER_LABELS: Record<string, string> = {
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
};

export default function KeyboardShortcutsDialog({ open, onOpenChange, userData }: KeyboardShortcutsDialogProps) {
  const { shortcuts, updateShortcut, resetToDefaults, checkDuplicate } = useKeyboardShortcuts();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordingKey, setRecordingKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'action', direction: 'asc' });

  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setEditingId(null);
      setRecordingKey(false);
    }
  }, [open]);

  // Handle keyboard recording
  useEffect(() => {
    if (!recordingKey || !editingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const key = e.key;
      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // Don't allow bare modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return;

      // Check if it's reserved
      const shortcut = shortcuts.find(s => s.id === editingId);
      if (shortcut?.reserved) {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: { text: 'System reserved shortcuts cannot be modified', isError: true },
        }));
        setRecordingKey(false);
        setEditingId(null);
        return;
      }

      // Check for duplicates
      const isDuplicate = checkDuplicate(key, ctrl, shift, alt, editingId);
      if (isDuplicate) {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: { text: 'This shortcut combination is already assigned to another action', isError: true },
        }));
        setRecordingKey(false);
        setEditingId(null);
        return;
      }

      // Update the shortcut
      updateShortcut(editingId, { key, ctrl, shift, alt });
      setRecordingKey(false);
      setEditingId(null);

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: 'Shortcut updated successfully', level: 'success' },
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingKey, editingId, shortcuts, checkDuplicate, updateShortcut]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const filteredAndSorted = useMemo(() => {
    let result = shortcuts;

    // Filter by search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.description.toLowerCase().includes(term) ||
        s.action.toLowerCase().includes(term) ||
        s.key.toLowerCase().includes(term) ||
        (s.ctrl && 'ctrl'.includes(term)) ||
        (s.shift && 'shift'.includes(term)) ||
        (s.alt && 'alt'.includes(term))
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal = '';
      let bVal = '';

      switch (sortConfig.key) {
        case 'action':
          aVal = a.description.toLowerCase();
          bVal = b.description.toLowerCase();
          break;
        case 'shortcut':
          aVal = formatShortcutKey(a).toLowerCase();
          bVal = formatShortcutKey(b).toLowerCase();
          break;
        case 'reserved':
          aVal = String(a.reserved || false);
          bVal = String(b.reserved || false);
          break;
        default:
          aVal = a.description.toLowerCase();
          bVal = b.description.toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [shortcuts, searchTerm, sortConfig]);

  const formatShortcutKey = (shortcut: ShortcutDef): string => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');

    const keyMap: Record<string, string> = {
      'ArrowLeft': '←',
      'ArrowRight': '→',
      'ArrowUp': '↑',
      'ArrowDown': '↓',
      'Escape': 'Esc',
      ' ': 'Space',
    };
    parts.push(keyMap[shortcut.key] || shortcut.key.toUpperCase());

    return parts.join(' + ');
  };

  const handleReset = async () => {
    resetToDefaults();

    // Audit log
    if (userData?.username) {
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userData.username,
          username: userData.name || userData.username,
          action: 'SHORTCUT_CHANGE',
          settingName: 'Keyboard Shortcuts',
          previousValue: 'Customized',
          newValue: 'Reset to defaults',
        }),
      }).catch(() => {});
    }

    window.dispatchEvent(new CustomEvent('sap-status', {
      detail: { text: 'All shortcuts reset to defaults', level: 'success' },
    }));
  };

  const handleClose = () => {
    if (editingId) {
      setEditingId(null);
      setRecordingKey(false);
    }
    onOpenChange(false);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 text-blue-600" />
      : <ChevronDown className="h-3 w-3 ml-1 text-blue-600" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl rounded-sm border-gray-400 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-gray-200 pb-3">
          <DialogTitle className="text-[14px] font-bold uppercase tracking-wider flex items-center gap-2 text-gray-800">
            <Keyboard className="h-4 w-4 text-blue-600" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-[11px] text-gray-500">
            View and customize keyboard shortcuts. Click on a shortcut to modify it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Bar */}
          <div className="relative flex items-center bg-white border border-gray-400 h-8 px-2 group focus-within:border-blue-500">
            <Search className="h-4 w-4 text-gray-400 mr-2" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full text-[12px] outline-none"
              placeholder="Search shortcuts by action or key combination..."
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-gray-400 hover:text-gray-600 px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Recording Indicator */}
          {recordingKey && (
            <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-sm animate-pulse">
              <MousePointerClick className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-[11px] font-bold text-yellow-800">Recording Shortcut...</p>
                <p className="text-[10px] text-yellow-700">Press the desired key combination on your keyboard</p>
              </div>
            </div>
          )}

          {/* Shortcuts Table */}
          <div className="border border-gray-200 rounded-sm overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto no-scrollbar">
              <table className="w-full">
                <thead className="bg-[#e7ebf1] sticky top-0 z-10">
                  <tr className="h-8 border-b border-[#b5c7de]">
                    <th
                      onClick={() => handleSort('action')}
                      className="text-[11px] font-bold border-r px-3 cursor-pointer hover:bg-gray-200 w-1/2"
                    >
                      <div className="flex items-center">
                        Action <SortIcon column="action" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('shortcut')}
                      className="text-[11px] font-bold border-r px-3 cursor-pointer hover:bg-gray-200 w-1/3"
                    >
                      <div className="flex items-center">
                        Shortcut <SortIcon column="shortcut" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('reserved')}
                      className="text-[11px] font-bold px-3 cursor-pointer hover:bg-gray-200 w-20 text-center"
                    >
                      <div className="flex items-center justify-center">
                        Type <SortIcon column="reserved" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-[11px] text-gray-400">
                        {searchTerm ? 'No shortcuts match your search' : 'No shortcuts available'}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSorted.map((shortcut) => (
                      <tr
                        key={shortcut.id}
                        className={cn(
                          "h-8 border-b border-gray-100 hover:bg-blue-50/50 transition-colors",
                          editingId === shortcut.id && "bg-blue-50"
                        )}
                      >
                        <td className="px-3 text-[11px] font-medium text-gray-700 border-r">
                          <div className="flex items-center gap-2">
                            {shortcut.reserved && <Lock className="h-3 w-3 text-amber-500" />}
                            {shortcut.description}
                          </div>
                        </td>
                        <td className="px-3 border-r">
                          {editingId === shortcut.id ? (
                            <span className="text-[11px] font-mono font-bold text-blue-700 bg-yellow-100 px-2 py-0.5 rounded animate-pulse">
                              Press keys...
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                if (shortcut.reserved) {
                                  window.dispatchEvent(new CustomEvent('sap-status', {
                                    detail: { text: 'System reserved shortcuts cannot be modified', isError: true },
                                  }));
                                  return;
                                }
                                setEditingId(shortcut.id);
                                setRecordingKey(true);
                              }}
                              className={cn(
                                "text-[11px] font-mono font-bold px-2 py-0.5 rounded transition-colors",
                                shortcut.reserved
                                  ? "text-gray-400 cursor-not-allowed"
                                  : "text-blue-700 hover:bg-blue-100 cursor-pointer"
                              )}
                              title={shortcut.reserved ? 'System reserved - cannot modify' : 'Click to customize'}
                            >
                              {formatShortcutKey(shortcut)}
                            </button>
                          )}
                        </td>
                        <td className="px-3 text-center">
                          {shortcut.reserved ? (
                            <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">
                              SYSTEM
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-800 font-bold rounded">
                              USER
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[9px] text-gray-500">
            <div className="flex items-center gap-1">
              <Lock className="h-3 w-3 text-amber-500" /> System Reserved
            </div>
            <div className="flex items-center gap-1">
              <MousePointerClick className="h-3 w-3 text-blue-500" /> Click to customize
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between w-full">
            <Button
              onClick={handleReset}
              variant="outline"
              className="h-7 text-[11px] rounded-none border-gray-400 text-amber-700 hover:text-amber-800"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset to Defaults
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="h-7 text-[11px] rounded-none border-gray-400"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
