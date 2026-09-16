"use client";

import { useEffect, useRef } from "react";
import { playGlobalSound, unlockAudioContext } from "@/hooks/use-sounds";

/**
 * Universal Sound Provider
 * Automatically provides audio feedback for all interactions across the entire application:
 * - Button clicks
 * - Checkboxes, switches, and radio buttons
 * - Tab switching
 * - Dialog and modal opening
 * - Tree and accordion expanding/collapsing
 * - Status messages (success, warning, error)
 */
export default function GlobalSoundProvider() {
  const lastDialogSoundTime = useRef<number>(0);
  const lastClickSoundTime = useRef<number>(0);

  useEffect(() => {
    // 1. Unlock AudioContext on first user interaction
    const handleFirstGesture = () => {
      unlockAudioContext();
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
    };

    window.addEventListener("pointerdown", handleFirstGesture, { capture: true, passive: true });
    window.addEventListener("keydown", handleFirstGesture, { capture: true, passive: true });

    // 2. Global Click Delegation
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Check if sound is explicitly disabled for this element
      if (target.closest('[data-sound="none"], [data-no-sound="true"]')) {
        return;
      }

      const now = Date.now();

      // Checkbox / Radio / Switch (including clickable rows containing a checkbox)
      const checkboxOrRadio =
        target.closest(
          'input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"], [role="switch"], button[role="checkbox"], button[role="switch"], [data-checkbox-container]'
        ) ||
        target.querySelector?.('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]') ||
        target.closest('div.cursor-pointer, label, li, tr')?.querySelector?.('input[type="checkbox"], [role="checkbox"], [role="switch"]');

      if (checkboxOrRadio) {
        unlockAudioContext();
        playGlobalSound("checkbox");
        lastClickSoundTime.current = now;
        return;
      }

      // Tab Switch
      const tabElement = target.closest('[role="tab"], button[role="tab"], [data-tab]');
      if (tabElement) {
        unlockAudioContext();
        playGlobalSound("tab_switch");
        lastClickSoundTime.current = now;
        return;
      }

      // Expand / Collapse (accordions, tree view nodes, collapsible sections)
      const isExpandTrigger = target.closest(
        '[aria-expanded], details summary, .tree-toggle, [data-accordion-trigger], button[data-state="closed"], button[data-state="open"]'
      );
      if (isExpandTrigger) {
        // Only if it's not a generic tab or dialog trigger
        if (!isExpandTrigger.getAttribute("role") || isExpandTrigger.getAttribute("role") !== "tab") {
          const hasExpandedAttr = isExpandTrigger.hasAttribute("aria-expanded");
          const isAccordion = isExpandTrigger.hasAttribute("data-accordion-trigger") || isExpandTrigger.tagName.toLowerCase() === "summary";
          if (hasExpandedAttr || isAccordion) {
            unlockAudioContext();
            playGlobalSound("expand");
            lastClickSoundTime.current = now;
            return;
          }
        }
      }

      // General Button click
      const buttonElement = target.closest(
        'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]'
      );
      if (buttonElement) {
        // Prevent double trigger if clicked within 40ms
        if (now - lastClickSoundTime.current < 40) return;
        lastClickSoundTime.current = now;

        unlockAudioContext();
        playGlobalSound("button_click");
        return;
      }
    };

    document.addEventListener("click", handleGlobalClick, { capture: true });

    // 3. Status Events (sap-status)
    const handleSapStatus = (event: Event) => {
      const customEvt = event as CustomEvent<{
        text?: string;
        isError?: boolean;
        level?: string;
        isWarning?: boolean;
      }>;
      const detail = customEvt.detail;
      if (!detail) return;

      unlockAudioContext();

      if (detail.isError || detail.level === "error") {
        playGlobalSound("error");
      } else if (detail.level === "warning" || detail.isWarning) {
        playGlobalSound("warning");
      } else if (detail.text && detail.text.trim().length > 0) {
        playGlobalSound("success");
      }
    };

    window.addEventListener("sap-status", handleSapStatus as EventListener);

    // 4. Modal / Dialog Open Observer
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (let i = 0; i < mutation.addedNodes.length; i++) {
            const node = mutation.addedNodes[i];
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              const isDialog =
                el.getAttribute("role") === "dialog" ||
                el.getAttribute("role") === "alertdialog" ||
                el.querySelector?.('[role="dialog"], [role="alertdialog"]');

              if (isDialog) {
                const now = Date.now();
                if (now - lastDialogSoundTime.current > 250) {
                  lastDialogSoundTime.current = now;
                  unlockAudioContext();
                  playGlobalSound("dialog");
                }
                return;
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.removeEventListener("pointerdown", handleFirstGesture);
      window.removeEventListener("keydown", handleFirstGesture);
      document.removeEventListener("click", handleGlobalClick, { capture: true });
      window.removeEventListener("sap-status", handleSapStatus as EventListener);
      observer.disconnect();
    };
  }, []);

  return null;
}
