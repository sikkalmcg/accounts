"use client";

import { useCallback, useEffect, useState } from 'react';

export interface ShortcutDef {
  id: string;
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: string;
  description: string;
  reserved?: boolean; // System-reserved shortcuts cannot be modified
}

export const SYSTEM_RESERVED_KEYS = ['F1', 'F3', 'F4', 'F8', 'Escape', 'F10', 'F11', 'F12'];

// Default shortcuts matching the SAP GUI specification
export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  { id: 'new_document', key: 'n', ctrl: true, action: 'new_document', description: 'New Document' },
  { id: 'save', key: 's', ctrl: true, action: 'save', description: 'Save' },
  { id: 'print', key: 'p', ctrl: true, action: 'print', description: 'Print' },
  { id: 'search', key: 'f', ctrl: true, action: 'search', description: 'Search' },
  { id: 'refresh', key: 'r', ctrl: true, action: 'refresh', description: 'Refresh' },
  { id: 'edit', key: 'e', ctrl: true, action: 'edit', description: 'Edit' },
  { id: 'delete', key: 'd', ctrl: true, action: 'delete', description: 'Delete' },
  { id: 'open', key: 'o', ctrl: true, action: 'open', description: 'Open' },
  { id: 'undo', key: 'z', ctrl: true, action: 'undo', description: 'Undo' },
  { id: 'redo', key: 'y', ctrl: true, action: 'redo', description: 'Redo' },
  { id: 'copy', key: 'c', ctrl: true, action: 'copy', description: 'Copy' },
  { id: 'paste', key: 'v', ctrl: true, action: 'paste', description: 'Paste' },
  { id: 'cut', key: 'x', ctrl: true, action: 'cut', description: 'Cut' },
  { id: 'select_all', key: 'a', ctrl: true, action: 'select_all', description: 'Select All' },
  { id: 'advanced_search', key: 'f', ctrl: true, shift: true, action: 'advanced_search', description: 'Advanced Search' },
  { id: 'prev_screen', key: 'ArrowLeft', alt: true, action: 'prev_screen', description: 'Previous Screen' },
  { id: 'next_screen', key: 'ArrowRight', alt: true, action: 'next_screen', description: 'Next Screen' },
  { id: 'cancel', key: 'Escape', action: 'cancel', description: 'Cancel / Close Dialog', reserved: true },
  { id: 'help', key: 'F1', action: 'help', description: 'Help', reserved: true },
  { id: 'rename', key: 'F2', action: 'rename', description: 'Rename / Edit' },
  { id: 'back', key: 'F3', action: 'back', description: 'Back', reserved: true },
  { id: 'value_help', key: 'F4', action: 'value_help', description: 'Value Help (Search Help)', reserved: true },
  { id: 'refresh_f5', key: 'F5', action: 'refresh_f5', description: 'Refresh' },
  { id: 'execute', key: 'F8', action: 'execute', description: 'Execute', reserved: true },
  { id: 'print_preview', key: 'F9', action: 'print_preview', description: 'Print Preview' },
  { id: 'menu_bar', key: 'F10', action: 'menu_bar', description: 'Menu Bar', reserved: true },
  { id: 'full_screen', key: 'F11', action: 'full_screen', description: 'Full Screen', reserved: true },
  { id: 'cancel_f12', key: 'F12', action: 'cancel_f12', description: 'Cancel', reserved: true },
];

export interface UserShortcuts {
  [shortcutId: string]: ShortcutDef;
}

export function useKeyboardShortcuts() {
  const [shortcuts, setShortcuts] = useState<ShortcutDef[]>(DEFAULT_SHORTCUTS);
  const [customizations, setCustomizations] = useState<UserShortcuts>({});

  useEffect(() => {
    // Load custom shortcuts from localStorage
    try {
      const saved = localStorage.getItem('sikka_shortcuts');
      if (saved) {
        const parsed = JSON.parse(saved) as UserShortcuts;
        setCustomizations(parsed);

        // Merge custom shortcuts with defaults
        const merged = DEFAULT_SHORTCUTS.map(def => {
          const custom = parsed[def.id];
          if (custom && !def.reserved) {
            return { ...def, ...custom, reserved: def.reserved };
          }
          return def;
        });
        setShortcuts(merged);
      }
    } catch {
      // ignore
    }
  }, []);

  const updateShortcut = useCallback((shortcutId: string, updates: Partial<ShortcutDef>) => {
    setShortcuts(prev => {
      const updated = prev.map(s => {
        if (s.id === shortcutId) {
          if (s.reserved) return s; // Cannot modify reserved shortcuts
          return { ...s, ...updates };
        }
        return s;
      });

      // Save to customizations
      const newCustom = updated.find(s => s.id === shortcutId);
      if (newCustom) {
        const newCustomizations = {
          ...customizations,
          [shortcutId]: newCustom,
        };
        setCustomizations(newCustomizations);
        localStorage.setItem('sikka_shortcuts', JSON.stringify(newCustomizations));

        // Save to user profile
        try {
          const stored = localStorage.getItem('sikka_user');
          if (stored) {
            const user = JSON.parse(stored);
            if (user.username) {
              fetch('/api/user-profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: user.username,
                  keyboardShortcuts: newCustomizations,
                }),
              }).catch(() => {});
            }
          }
        } catch {
          // ignore
        }
      }

      return updated;
    });
  }, [customizations]);

  const resetToDefaults = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    setCustomizations({});
    localStorage.setItem('sikka_shortcuts', JSON.stringify({}));

    // Save reset to user profile
    try {
      const stored = localStorage.getItem('sikka_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.username) {
          fetch('/api/user-profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.username,
              keyboardShortcuts: {},
            }),
          }).catch(() => {});
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const findShortcutByKey = useCallback((e: KeyboardEvent): ShortcutDef | undefined => {
    return shortcuts.find(s => {
      const keyMatch = s.key.toLowerCase() === e.key.toLowerCase() ||
        (s.key === 'Escape' && e.key === 'Escape') ||
        (s.key.startsWith('F') && e.key === s.key);
      const ctrlMatch = !!s.ctrl === e.ctrlKey;
      const shiftMatch = !!s.shift === e.shiftKey;
      const altMatch = !!s.alt === e.altKey;
      return keyMatch && ctrlMatch && shiftMatch && altMatch;
    });
  }, [shortcuts]);

  const checkDuplicate = useCallback((key: string, ctrl?: boolean, shift?: boolean, alt?: boolean, excludeId?: string): boolean => {
    return shortcuts.some(s => {
      if (s.id === excludeId) return false;
      return s.key.toLowerCase() === key.toLowerCase() &&
        !!s.ctrl === !!ctrl &&
        !!s.shift === !!shift &&
        !!s.alt === !!alt;
    });
  }, [shortcuts]);

  return {
    shortcuts,
    updateShortcut,
    resetToDefaults,
    findShortcutByKey,
    checkDuplicate,
  };
}

