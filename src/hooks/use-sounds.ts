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

// Cached shared AudioContext
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Unlock audio on first user gesture
export function unlockAudioContext(): void {
  if (typeof window === 'undefined') return;
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Synthesizes crisp real-time audio effects using Web Audio API
 * Every event is designed with RADICALLY DISTINCT pitch, rhythm, and timbre
 */
function playSynthesizedTone(
  scheme: SoundScheme,
  event: SoundEvent
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  switch (scheme) {
    case 'sap_classic': {
      switch (event) {
        case 'checkbox': {
          // 1. CHECKBOX: Distinct springy "Ka-chik!" double-latch
          // First tick (low crisp transient)
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'triangle';
          osc1.frequency.setValueAtTime(650, now);
          osc1.frequency.exponentialRampToValueAtTime(300, now + 0.015);
          gain1.gain.setValueAtTime(0.35, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.015);

          // Second tick (high bright latch snap 30ms later)
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1850, now + 0.03);
          osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.065);
          gain2.gain.setValueAtTime(0.4, now + 0.03);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.03);
          osc2.stop(now + 0.065);
          break;
        }

        case 'button_click': {
          // 2. BUTTON CLICK: Deep, punchy, solid single "Tock!"
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(75, now + 0.045);
          gain.gain.setValueAtTime(0.45, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.045);
          break;
        }

        case 'tab_switch': {
          // 3. SWITCH TAB: Smooth ascending fluid sweep / slide ("Fwooo-ip!")
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(340, now);
          osc.frequency.exponentialRampToValueAtTime(920, now + 0.08);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.linearRampToValueAtTime(0.3, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        }

        case 'expand': {
          // 4. EXPAND / COLLAPSE: Hollow wooden double-tap ("Tok-tok!")
          // Tap 1: Lower woodblock
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(320, now);
          osc1.frequency.exponentialRampToValueAtTime(200, now + 0.035);
          gain1.gain.setValueAtTime(0.38, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.035);

          // Tap 2: Higher resonant woodblock (45ms later)
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(480, now + 0.045);
          osc2.frequency.exponentialRampToValueAtTime(320, now + 0.085);
          gain2.gain.setValueAtTime(0.35, now + 0.045);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.045);
          osc2.stop(now + 0.085);
          break;
        }

        case 'dialog': {
          // 5. OPEN DIALOG: Ascending 3-note melodic glass window chime ("Ding-dong-chime!")
          [
            { freq: 523.25, time: 0, dur: 0.1 },      // C5
            { freq: 659.25, time: 0.07, dur: 0.12 },   // E5
            { freq: 1046.50, time: 0.14, dur: 0.22 }, // C6
          ].forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + time);
            gain.gain.setValueAtTime(0, now + time);
            gain.gain.linearRampToValueAtTime(0.3, now + time + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + time);
            osc.stop(now + time + dur);
          });
          break;
        }

        case 'success': {
          // SAP positive ascending triumphant triad (C5 -> E5 -> G5 -> C6)
          [
            { freq: 523.25, time: 0, dur: 0.09 },
            { freq: 659.25, time: 0.08, dur: 0.1 },
            { freq: 783.99, time: 0.16, dur: 0.12 },
            { freq: 1046.5, time: 0.24, dur: 0.24 },
          ].forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + time);
            gain.gain.setValueAtTime(0, now + time);
            gain.gain.linearRampToValueAtTime(0.28, now + time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + time);
            osc.stop(now + time + dur);
          });
          break;
        }

        case 'warning': {
          // SAP alert (harmonic two-tone alert)
          [
            { freq: 660, time: 0, dur: 0.15 },
            { freq: 520, time: 0.07, dur: 0.18 },
          ].forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + time);
            gain.gain.setValueAtTime(0.24, now + time);
            gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + time);
            osc.stop(now + time + dur);
          });
          break;
        }

        case 'error': {
          // SAP error bonk / discordant buzz
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = 'sawtooth';
          osc2.type = 'square';
          osc1.frequency.setValueAtTime(160, now);
          osc2.frequency.setValueAtTime(225, now);
          gain.gain.setValueAtTime(0.32, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.22);
          osc2.stop(now + 0.22);
          break;
        }
      }
      break;
    }

    case 'sap_countryside': {
      switch (event) {
        case 'checkbox': {
          // Bamboo double-snap
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(550, now);
          gain1.gain.setValueAtTime(0.35, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.02);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(1600, now + 0.03);
          gain2.gain.setValueAtTime(0.38, now + 0.03);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.03);
          osc2.stop(now + 0.06);
          break;
        }

        case 'button_click': {
          // Deep acoustic marimba mallet strike
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(196, now); // G3
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);
          gain.gain.setValueAtTime(0.45, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.06);
          break;
        }

        case 'tab_switch': {
          // Gentle acoustic flute glide
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(420, now);
          osc.frequency.exponentialRampToValueAtTime(840, now + 0.09);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.linearRampToValueAtTime(0.28, now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.09);
          break;
        }

        case 'expand': {
          // Hollow castanet / nut tap
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(280, now);
          gain1.gain.setValueAtTime(0.35, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.03);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(420, now + 0.04);
          gain2.gain.setValueAtTime(0.32, now + 0.04);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.04);
          osc2.stop(now + 0.075);
          break;
        }

        case 'dialog': {
          // 4-note acoustic bell cascade
          [
            { freq: 659.25, time: 0, dur: 0.1 },
            { freq: 830.61, time: 0.06, dur: 0.12 },
            { freq: 987.77, time: 0.12, dur: 0.14 },
            { freq: 1318.51, time: 0.18, dur: 0.25 },
          ].forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + time);
            gain.gain.setValueAtTime(0, now + time);
            gain.gain.linearRampToValueAtTime(0.26, now + time + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + time);
            osc.stop(now + time + dur);
          });
          break;
        }

        case 'success': {
          // Bright acoustic marimba arpeggio (E5 -> G#5 -> B5 -> E6)
          [
            { freq: 659.25, time: 0, dur: 0.1 },
            { freq: 830.61, time: 0.06, dur: 0.1 },
            { freq: 987.77, time: 0.12, dur: 0.12 },
            { freq: 1318.51, time: 0.18, dur: 0.25 },
          ].forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + time);
            gain.gain.setValueAtTime(0.28, now + time);
            gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + time);
            osc.stop(now + time + dur);
          });
          break;
        }

        case 'warning': {
          // Warm acoustic bell (A5 -> F#5)
          [
            { freq: 880, time: 0, dur: 0.14 },
            { freq: 739.99, time: 0.07, dur: 0.18 },
          ].forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + time);
            gain.gain.setValueAtTime(0.22, now + time);
            gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + time);
            osc.stop(now + time + dur);
          });
          break;
        }

        case 'error': {
          // Resonant wooden drop / hollow gong
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.22);
          break;
        }
      }
      break;
    }

    case 'windows_default': {
      switch (event) {
        case 'checkbox': {
          // Windows navigation select snap (dual crisp chirp)
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(1100, now);
          gain1.gain.setValueAtTime(0.3, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.015);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1750, now + 0.025);
          gain2.gain.setValueAtTime(0.35, now + 0.025);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.025);
          osc2.stop(now + 0.05);
          break;
        }

        case 'button_click': {
          // Classic Windows mouse press (crisp 550Hz mechanical click)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(550, now);
          osc.frequency.exponentialRampToValueAtTime(120, now + 0.025);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.025);
          break;
        }

        case 'tab_switch': {
          // Windows card flip / tab sweep
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(450, now);
          osc.frequency.exponentialRampToValueAtTime(780, now + 0.07);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.07);
          break;
        }

        case 'expand': {
          // Windows folder toggle double-knock
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(450, now);
          gain1.gain.setValueAtTime(0.3, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.025);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(650, now + 0.035);
          gain2.gain.setValueAtTime(0.28, now + 0.035);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.035);
          osc2.stop(now + 0.065);
          break;
        }

        case 'dialog': {
          // Windows Balloon / Open fanfare (440Hz -> 660Hz -> 880Hz)
          [
            { freq: 440, time: 0, dur: 0.08 },
            { freq: 659.25, time: 0.05, dur: 0.1 },
            { freq: 880, time: 0.1, dur: 0.18 },
          ].forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + time);
            gain.gain.setValueAtTime(0.26, now + time);
            gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + time);
            osc.stop(now + time + dur);
          });
          break;
        }

        case 'success': {
          // Windows Ding / Asterisk chime (sparkling dual tone)
          [
            { freq: 1046.5, time: 0, dur: 0.12 },
            { freq: 1567.98, time: 0.06, dur: 0.22 },
          ].forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + time);
            gain.gain.setValueAtTime(0.26, now + time);
            gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + time);
            osc.stop(now + time + dur);
          });
          break;
        }

        case 'warning': {
          // Windows Exclamation (D5 -> A5)
          [
            { freq: 587.33, time: 0, dur: 0.1 },
            { freq: 880, time: 0.06, dur: 0.18 },
          ].forEach(({ freq, time, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + time);
            gain.gain.setValueAtTime(0.28, now + time);
            gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + time);
            osc.stop(now + time + dur);
          });
          break;
        }

        case 'error': {
          // Windows Critical Stop Chord (C3 + E3 + G3 chord)
          [130.81, 164.81, 196.0, 261.63].forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.3);
          });
          break;
        }
      }
      break;
    }

    default:
      break;
  }
}

/**
 * Generates a valid 16-bit PCM WAV Data URI for static audio compatibility
 */
function createWavDataUri(
  durationMs: number,
  sampleRate: number,
  sampleFn: (t: number) => number
): string {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 1 channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // 16 bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.max(-1, Math.min(1, sampleFn(t)));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + (typeof btoa !== 'undefined' ? btoa(binary) : '');
}

// Generate valid playable WAV data for presets with distinct profiles
export const SOUND_PRESETS: Record<SoundScheme, Partial<Record<SoundEvent, string>>> = {
  sap_classic: {
    checkbox: createWavDataUri(80, 22050, (t) => {
      // Ka-chik: low tick then high latch
      if (t < 0.025) return Math.sin(2 * Math.PI * 650 * t) * Math.exp(-t * 120);
      if (t > 0.035 && t < 0.075) return Math.sin(2 * Math.PI * 1850 * (t - 0.035)) * Math.exp(-(t - 0.035) * 80);
      return 0;
    }),
    button_click: createWavDataUri(50, 22050, (t) => Math.sin(2 * Math.PI * (260 - 185 * (t / 0.05)) * t) * Math.exp(-t * 60)),
    tab_switch: createWavDataUri(85, 22050, (t) => Math.sin(2 * Math.PI * (340 + 580 * (t / 0.085)) * t) * Math.exp(-t * 20)),
    expand: createWavDataUri(90, 22050, (t) => {
      if (t < 0.035) return Math.sin(2 * Math.PI * 320 * t) * Math.exp(-t * 70);
      if (t > 0.045 && t < 0.085) return Math.sin(2 * Math.PI * 480 * (t - 0.045)) * Math.exp(-(t - 0.045) * 70);
      return 0;
    }),
    dialog: createWavDataUri(300, 22050, (t) => {
      const f = t < 0.07 ? 523.25 : t < 0.14 ? 659.25 : 1046.50;
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-(t % 0.07) * 12);
    }),
    success: createWavDataUri(320, 22050, (t) => {
      const f = t < 0.08 ? 523.25 : t < 0.16 ? 659.25 : t < 0.24 ? 783.99 : 1046.5;
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-(t % 0.08) * 10);
    }),
    warning: createWavDataUri(220, 22050, (t) => {
      const f = t < 0.09 ? 660 : 520;
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 8);
    }),
    error: createWavDataUri(220, 22050, (t) => (Math.sin(2 * Math.PI * 160 * t) + Math.sin(2 * Math.PI * 225 * t)) * 0.5 * Math.exp(-t * 8)),
  },
  sap_countryside: {
    checkbox: createWavDataUri(70, 22050, (t) => {
      if (t < 0.02) return Math.sin(2 * Math.PI * 550 * t) * Math.exp(-t * 100);
      if (t > 0.03 && t < 0.065) return Math.sin(2 * Math.PI * 1600 * (t - 0.03)) * Math.exp(-(t - 0.03) * 90);
      return 0;
    }),
    button_click: createWavDataUri(70, 22050, (t) => Math.sin(2 * Math.PI * 196 * t) * Math.exp(-t * 40)),
    tab_switch: createWavDataUri(90, 22050, (t) => Math.sin(2 * Math.PI * (420 + 420 * (t / 0.09)) * t) * Math.exp(-t * 20)),
    expand: createWavDataUri(80, 22050, (t) => {
      if (t < 0.03) return Math.sin(2 * Math.PI * 280 * t) * Math.exp(-t * 80);
      if (t > 0.04 && t < 0.075) return Math.sin(2 * Math.PI * 420 * (t - 0.04)) * Math.exp(-(t - 0.04) * 80);
      return 0;
    }),
    dialog: createWavDataUri(320, 22050, (t) => {
      const f = t < 0.06 ? 659.25 : t < 0.12 ? 830.61 : t < 0.18 ? 987.77 : 1318.51;
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-(t % 0.06) * 12);
    }),
    success: createWavDataUri(320, 22050, (t) => {
      const f = t < 0.07 ? 659.25 : t < 0.14 ? 830.61 : t < 0.21 ? 987.77 : 1318.51;
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-(t % 0.07) * 12);
    }),
    warning: createWavDataUri(220, 22050, (t) => {
      const f = t < 0.09 ? 880 : 739.99;
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 8);
    }),
    error: createWavDataUri(220, 22050, (t) => Math.sin(2 * Math.PI * (240 - 100 * (t / 0.22)) * t) * Math.exp(-t * 8)),
  },
  windows_default: {
    checkbox: createWavDataUri(60, 22050, (t) => {
      if (t < 0.02) return Math.sin(2 * Math.PI * 1100 * t) * Math.exp(-t * 100);
      if (t > 0.025 && t < 0.055) return Math.sin(2 * Math.PI * 1750 * (t - 0.025)) * Math.exp(-(t - 0.025) * 80);
      return 0;
    }),
    button_click: createWavDataUri(30, 22050, (t) => Math.sin(2 * Math.PI * 550 * t) * Math.exp(-t * 80)),
    tab_switch: createWavDataUri(70, 22050, (t) => Math.sin(2 * Math.PI * (450 + 330 * (t / 0.07)) * t) * Math.exp(-t * 30)),
    expand: createWavDataUri(70, 22050, (t) => {
      if (t < 0.025) return Math.sin(2 * Math.PI * 450 * t) * Math.exp(-t * 90);
      if (t > 0.035 && t < 0.065) return Math.sin(2 * Math.PI * 650 * (t - 0.035)) * Math.exp(-(t - 0.035) * 90);
      return 0;
    }),
    dialog: createWavDataUri(250, 22050, (t) => {
      const f = t < 0.06 ? 440 : t < 0.12 ? 659.25 : 880;
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-(t % 0.06) * 12);
    }),
    success: createWavDataUri(280, 22050, (t) => (Math.sin(2 * Math.PI * 1046.5 * t) + Math.sin(2 * Math.PI * 1567.98 * t)) * 0.5 * Math.exp(-t * 8)),
    warning: createWavDataUri(220, 22050, (t) => {
      const f = t < 0.08 ? 587.33 : 880;
      return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 8);
    }),
    error: createWavDataUri(300, 22050, (t) => (Math.sin(2 * Math.PI * 130.81 * t) + Math.sin(2 * Math.PI * 196.0 * t) + Math.sin(2 * Math.PI * 261.63 * t)) * 0.33 * Math.exp(-t * 6)),
  },
  no_sound: {},
  custom: {},
};

// Global active settings reference
let activeGlobalSettings: SoundSettings = DEFAULT_SETTINGS;

function loadStoredSettings(): SoundSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem('sikka_sound_settings');
    if (saved) {
      const parsed = JSON.parse(saved) as SoundSettings;
      activeGlobalSettings = { ...DEFAULT_SETTINGS, ...parsed };
      return activeGlobalSettings;
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function useSounds() {
  const [settings, setSettings] = useState<SoundSettings>(() => {
    return loadStoredSettings();
  });
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
    activeGlobalSettings = settings;
  }, [settings]);

  useEffect(() => {
    const loaded = loadStoredSettings();
    setSettings(loaded);
  }, []);

  const playSound = useCallback((event: SoundEvent, overrideSettings?: Partial<SoundSettings>) => {
    const current = { ...settingsRef.current, ...overrideSettings };
    if (!current.enabled) return;
    if (current.scheme === 'no_sound') return;

    // Custom sound playback
    if (current.scheme === 'custom' && current.customSounds?.[event]) {
      try {
        const audio = new Audio(current.customSounds[event]);
        audio.volume = 0.5;
        audio.play().catch(() => {});
        return;
      } catch {
        // fall back to classic synthesis
      }
    }

    const schemeToPlay: SoundScheme = current.scheme === 'custom' ? 'sap_classic' : current.scheme;

    // First try Web Audio API zero-latency synthesis
    const ctx = getAudioContext();
    if (ctx) {
      playSynthesizedTone(schemeToPlay, event);
      return;
    }

    // Fallback to data URL
    const soundData = SOUND_PRESETS[schemeToPlay]?.[event];
    if (soundData) {
      try {
        const audio = new Audio(soundData);
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: SoundSettings) => {
    setSettings(newSettings);
    activeGlobalSettings = newSettings;
    localStorage.setItem('sikka_sound_settings', JSON.stringify(newSettings));

    // Save to user profile if user is logged in
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

// Global sound player function
let customGlobalPlayer: ((event: SoundEvent) => void) | null = null;

export function setGlobalSoundPlayer(player: (event: SoundEvent) => void) {
  customGlobalPlayer = player;
}

// Throttle rapid sounds (e.g. key repeat or multi-clicks)
let lastPlayTimes: Partial<Record<SoundEvent, number>> = {};

export function playGlobalSound(event: SoundEvent, overrideSettings?: Partial<SoundSettings>) {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const lastTime = lastPlayTimes[event] || 0;
  // Throttle rapid clicks to prevent sound clipping
  if (now - lastTime < 30) {
    return;
  }
  lastPlayTimes[event] = now;

  if (customGlobalPlayer && !overrideSettings) {
    customGlobalPlayer(event);
    return;
  }

  const currentSettings = { ...loadStoredSettings(), ...overrideSettings };
  if (!currentSettings.enabled) return;
  if (currentSettings.scheme === 'no_sound') return;

  // Custom sound
  if (currentSettings.scheme === 'custom' && currentSettings.customSounds?.[event]) {
    try {
      const audio = new Audio(currentSettings.customSounds[event]);
      audio.volume = 0.5;
      audio.play().catch(() => {});
      return;
    } catch {
      // fallback
    }
  }

  const schemeToPlay: SoundScheme = currentSettings.scheme === 'custom' ? 'sap_classic' : currentSettings.scheme;

  const ctx = getAudioContext();
  if (ctx) {
    playSynthesizedTone(schemeToPlay, event);
  } else {
    const soundData = SOUND_PRESETS[schemeToPlay]?.[event];
    if (soundData) {
      try {
        const audio = new Audio(soundData);
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    }
  }
}
