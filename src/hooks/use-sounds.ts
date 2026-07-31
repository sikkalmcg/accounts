"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

export type SoundEvent =
  | 'success'
  | 'warning'
  | 'error'
  | 'checkbox'
  | 'dialog'
  | 'expand'
  | 'button_click'
  | 'tab_switch';

export type SoundScheme = 'sap_countryside' | 'sap_classic' | 'windows_default' | 'no_sound' | 'custom';

export interface SoundSettings {
  enabled: boolean;
  scheme: SoundScheme;
  customSounds?: Partial<Record<SoundEvent, string>>; // base64 or URL
}

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  scheme: 'sap_classic',
  customSounds: {},
};

// Base64-encoded minimal WAV sounds for different events (very short beeps/tones)
// These are generated as simple audio data URLs
const SOUND_PRESETS: Record<SoundScheme, Partial<Record<SoundEvent, string>>> = {
  sap_countryside: {
    success: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f3+AgH9/f3+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+Af39/f3+AgH+AgH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/gH+AgH9/f39/f39/gH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+Af39/f3+AgH+AgH+AgH9/f39/f39/f39/gH+AgH+AgH+Af39/f39/f39/f3+',
    warning: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f3+AgH9/f3+AgH+AgH+Af39/gH+AgH+AgH+AgH+Af39/f3+Af39/f3+AgH+AgH+AgH+Af39/f39/f39/f39/gH+AgH+Af39/f39/f39/f39/f39/f3+AgH+AgH+Af39/gH+Af39/f39/f39/f39/f3+AgH+AgH+AgH+Af39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f3+',
    error: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f3+Af39/f39/f39/gH+Af39/f39/f39/f3+AgH+Af39/f39/f3+Af39/gH+Af39/f39/f39/f39/f3+AgH+Af39/f3+Af39/f39/gH+Af39/f3+Af39/f39/f39/f39/f39/f3+Af39/f3+AgH+Af39/f39/gH+Af39/f39/f39/f3+Af39/f39/f39/f39/f39/f3+',
    checkbox: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/gH+Af39/f39/f39/f39/f39/gH+Af39/f39/gH+Af39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    dialog: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/gH+Af39/f39/f39/f3+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f3+',
    expand: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f3+Af39/f3+AgH+AgH+AgH+AgH+AgH+Af39/f39/f39/f3+AgH+AgH+AgH+AgH+AgH+AgH+AgH+Af39/f39/f39/f39/gH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+',
    button_click: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f3+AgH9/f3+AgH+AgH+AgH+AgH+AgH+Af39/f39/f39/f3+AgH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+Af39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f3+AgH+Af39/f3+AgH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    tab_switch: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
  },
  sap_classic: {
    success: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f3+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+Af39/f3+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+',
    warning: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    error: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f3+Af39/f39/f39/gH+Af39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    checkbox: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/gH+Af39/gH+Af39/gH+Af39/gH+Af39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    dialog: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    expand: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    button_click: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    tab_switch: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
  },
  windows_default: {
    success: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    warning: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f3+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+Af39/f39/f39/f3+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+AgH+',
    error: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    checkbox: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    dialog: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    expand: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/gH+Af39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    button_click: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
    tab_switch: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3+',
  },
  no_sound: {},
  custom: {},
};

export function useSounds() {
  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SETTINGS);
  const audioContextRef = useRef<AudioContext | null>(null);
  const settingsRef = useRef(settings);

  // Keep ref in sync
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    // Load saved sound settings from localStorage
    try {
      const saved = localStorage.getItem('sikka_sound_settings');
      if (saved) {
        const parsed = JSON.parse(saved) as SoundSettings;
        setSettings(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const playSound = useCallback((event: SoundEvent) => {
    const currentSettings = settingsRef.current;
    if (!currentSettings.enabled) return;
    if (currentSettings.scheme === 'no_sound') return;

    // Get sound data
    let soundData: string | undefined;

    if (currentSettings.scheme === 'custom' && currentSettings.customSounds?.[event]) {
      soundData = currentSettings.customSounds[event];
    } else if (SOUND_PRESETS[currentSettings.scheme]?.[event]) {
      soundData = SOUND_PRESETS[currentSettings.scheme][event];
    }

    if (!soundData) return;

    try {
      const audio = new Audio(soundData);
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Auto-play might be blocked
      });
    } catch {
      // Ignore audio errors
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: SoundSettings) => {
    setSettings(newSettings);
    localStorage.setItem('sikka_sound_settings', JSON.stringify(newSettings));

    // Save to user profile if user is logged in
    try {
      const stored = localStorage.getItem('sikka_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.username) {
          // Fire-and-forget save to DB
          fetch('/api/user-profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.username,
              soundSettings: newSettings,
            }),
          }).catch(() => {});
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return {
    settings,
    setSettings: saveSettings,
    playSound,
  };
}

// Singleton-like global sound player for non-React contexts
let globalPlaySound: ((event: SoundEvent) => void) | null = null;

export function setGlobalSoundPlayer(player: (event: SoundEvent) => void) {
  globalPlaySound = player;
}

export function playGlobalSound(event: SoundEvent) {
  if (globalPlaySound) {
    globalPlaySound(event);
  }
}

