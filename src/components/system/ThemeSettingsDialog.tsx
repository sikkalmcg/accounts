"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Palette,
  Loader2,
  CheckCircle2,
  Monitor,
  Sun,
  Moon,
  Eye,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTheme: string;
  onApplyTheme: (theme: string) => void;
  userData: any;
}

interface ThemeOption {
  id: string;
  name: string;
  category: 'quartz' | 'belize' | 'crystal' | 'corbu' | 'sap' | 'classic';
  description: string;
  isDark?: boolean;
  isHighContrast?: boolean;
  colors: {
    primary: string;
    background: string;
    surface: string;
    text: string;
    accent: string;
    border: string;
  };
}

const THEMES: ThemeOption[] = [
  {
    id: 'quartz_light',
    name: 'Quartz Light',
    category: 'quartz',
    description: 'Modern light theme with quartz-inspired design',
    colors: { primary: '#1A6FB9', background: '#F5F7FA', surface: '#FFFFFF', text: '#1C1C1C', accent: '#4CAF50', border: '#D9D9D9' },
  },
  {
    id: 'quartz_dark',
    name: 'Quartz Dark',
    category: 'quartz',
    isDark: true,
    description: 'Dark variant of Quartz theme',
    colors: { primary: '#4FC3F7', background: '#1A1A2E', surface: '#2D2D44', text: '#E0E0E0', accent: '#66BB6A', border: '#404060' },
  },
  {
    id: 'quartz_hc_black',
    name: 'Quartz High Contrast Black',
    category: 'quartz',
    isDark: true,
    isHighContrast: true,
    description: 'High contrast black theme for accessibility',
    colors: { primary: '#FFFFFF', background: '#000000', surface: '#1A1A1A', text: '#FFFFFF', accent: '#FFFF00', border: '#FFFFFF' },
  },
  {
    id: 'quartz_hc_white',
    name: 'Quartz High Contrast White',
    category: 'quartz',
    isHighContrast: true,
    description: 'High contrast white theme for accessibility',
    colors: { primary: '#000000', background: '#FFFFFF', surface: '#F5F5F5', text: '#000000', accent: '#0000FF', border: '#000000' },
  },
  {
    id: 'belize',
    name: 'Belize',
    category: 'belize',
    description: 'Classic SAP Belize theme',
    colors: { primary: '#0070C0', background: '#F0F8FF', surface: '#FFFFFF', text: '#1C1C1C', accent: '#FF8C00', border: '#B0C4DE' },
  },
  {
    id: 'belize_hc_black',
    name: 'Belize High Contrast Black',
    category: 'belize',
    isDark: true,
    isHighContrast: true,
    description: 'High contrast black variant of Belize',
    colors: { primary: '#87CEEB', background: '#0A0A0A', surface: '#1A1A1A', text: '#FFFFFF', accent: '#FFD700', border: '#87CEEB' },
  },
  {
    id: 'belize_hc_white',
    name: 'Belize High Contrast White',
    category: 'belize',
    isHighContrast: true,
    description: 'High contrast white variant of Belize',
    colors: { primary: '#0050A0', background: '#FFFFFF', surface: '#F8F8F8', text: '#000000', accent: '#FF6600', border: '#0050A0' },
  },
  {
    id: 'blue_crystal',
    name: 'Blue Crystal',
    category: 'crystal',
    description: 'Crystal clear blue theme',
    colors: { primary: '#2B579A', background: '#E8F0FE', surface: '#FFFFFF', text: '#1C1C1C', accent: '#00BFFF', border: '#B8D4F0' },
  },
  {
    id: 'corbu',
    name: 'Corbu',
    category: 'corbu',
    description: 'Modern Corbu design theme',
    colors: { primary: '#E65100', background: '#FFF8F0', surface: '#FFFFFF', text: '#1C1C1C', accent: '#FF6F00', border: '#FFCC80' },
  },
  {
    id: 'sap_signature',
    name: 'SAP Signature',
    category: 'sap',
    description: 'Official SAP Fiori signature theme',
    colors: { primary: '#1870C0', background: '#F3F6F9', surface: '#FFFFFF', text: '#32363A', accent: '#2B7C6B', border: '#D1D5DB' },
  },
  {
    id: 'sap_signature_hc',
    name: 'SAP Signature High Contrast Black',
    category: 'sap',
    isDark: true,
    isHighContrast: true,
    description: 'High contrast black SAP signature theme',
    colors: { primary: '#91C8F6', background: '#000000', surface: '#1A1D21', text: '#FFFFFF', accent: '#93C572', border: '#91C8F6' },
  },
  {
    id: 'classic',
    name: 'SAP Classic',
    category: 'classic',
    description: 'Original SAP GUI classic theme',
    colors: { primary: '#2A6BD5', background: '#F0F0F0', surface: '#FFFFFF', text: '#333333', accent: '#6CD1F3', border: '#B5C7DE' },
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  quartz: 'Quartz',
  belize: 'Belize',
  crystal: 'Crystal',
  corbu: 'Corbu',
  sap: 'SAP',
  classic: 'Classic',
};

export default function ThemeSettingsDialog({ open, onOpenChange, currentTheme, onApplyTheme, userData }: ThemeSettingsDialogProps) {
  const [selectedTheme, setSelectedTheme] = useState(currentTheme);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedTheme(currentTheme);
      setPreviewTheme(null);
      setShowRestartDialog(false);
    }
  }, [open, currentTheme]);

  const handleThemeClick = (themeId: string) => {
    setSelectedTheme(themeId);
    setPreviewTheme(themeId);
  };

  const handleApply = async () => {
    setIsApplying(true);

    try {
      // Apply theme
      onApplyTheme(selectedTheme);
      localStorage.setItem('sikka_theme', selectedTheme);

      // Save to user profile
      if (userData?.username) {
        await fetch('/api/user-profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userData.username,
            theme: selectedTheme,
          }),
        });

        // Audit log
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userData.username,
            username: userData.name || userData.username,
            action: 'THEME_CHANGE',
            settingName: 'Theme',
            previousValue: currentTheme,
            newValue: selectedTheme,
          }),
        }).catch(() => {});
      }

      // Show restart dialog for certain themes
      const requiresRestart = ['quartz_dark', 'quartz_hc_black', 'quartz_hc_white', 'belize_hc_black', 'belize_hc_white', 'sap_signature_hc'].includes(selectedTheme);
      if (requiresRestart) {
        setShowRestartDialog(true);
      } else {
        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: { text: `Theme changed to ${THEMES.find(t => t.id === selectedTheme)?.name || selectedTheme}`, level: 'success' },
        }));
        onOpenChange(false);
      }
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Error: ${err.message}`, isError: true },
      }));
    } finally {
      setIsApplying(false);
    }
  };

  const handleRestartNow = () => {
    localStorage.setItem('sikka_theme', selectedTheme);
    window.location.reload();
  };

  const handleRestartLater = () => {
    window.dispatchEvent(new CustomEvent('sap-status', {
      detail: { text: 'Theme will be applied after next restart', level: 'info' },
    }));
    onOpenChange(false);
  };

  const selectedThemeObj = THEMES.find(t => t.id === selectedTheme);

  return (
    <>
      <Dialog open={open && !showRestartDialog} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl rounded-sm border-gray-400 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-gray-200 pb-3">
            <DialogTitle className="text-[14px] font-bold uppercase tracking-wider flex items-center gap-2 text-gray-800">
              <Palette className="h-4 w-4 text-blue-600" />
              Theme Settings
            </DialogTitle>
            <DialogDescription className="text-[11px] text-gray-500">
              Personalize the application appearance. Select a theme below to preview.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {/* Live Preview */}
            {previewTheme && (
              <div
                className="border-2 border-blue-400 rounded-sm p-4 transition-all duration-300"
                style={{
                  backgroundColor: THEMES.find(t => t.id === previewTheme)?.colors.background,
                  color: THEMES.find(t => t.id === previewTheme)?.colors.text,
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Live Preview</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div
                    className="h-16 rounded-sm flex items-center justify-center text-[10px] font-bold"
                    style={{
                      backgroundColor: THEMES.find(t => t.id === previewTheme)?.colors.primary,
                      color: '#FFFFFF',
                    }}
                  >
                    Primary Button
                  </div>
                  <div
                    className="h-16 rounded-sm flex items-center justify-center text-[10px] font-bold border"
                    style={{
                      borderColor: THEMES.find(t => t.id === previewTheme)?.colors.border,
                      color: THEMES.find(t => t.id === previewTheme)?.colors.text,
                    }}
                  >
                    Secondary
                  </div>
                  <div
                    className="h-16 rounded-sm flex items-center justify-center text-[10px] font-bold"
                    style={{
                      backgroundColor: THEMES.find(t => t.id === previewTheme)?.colors.accent,
                      color: '#FFFFFF',
                    }}
                  >
                    Accent
                  </div>
                </div>
                <div
                  className="mt-3 h-8 rounded-sm flex items-center px-3 text-[10px]"
                  style={{
                    backgroundColor: THEMES.find(t => t.id === previewTheme)?.colors.surface,
                    border: `1px solid ${THEMES.find(t => t.id === previewTheme)?.colors.border}`,
                    color: THEMES.find(t => t.id === previewTheme)?.colors.text,
                  }}
                >
                  Sample input field with text
                </div>
              </div>
            )}

            {/* Theme Grid */}
            {Object.entries(CATEGORY_LABELS).map(([category, label]) => {
              const categoryThemes = THEMES.filter(t => t.category === category);
              if (categoryThemes.length === 0) return null;

              return (
                <div key={category}>
                  <h3 className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2 px-1">
                    {label} Theme
                  </h3>
                  <div className="grid grid-cols-4 gap-3">
                    {categoryThemes.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => handleThemeClick(theme.id)}
                        className={cn(
                          "border-2 p-2 rounded-sm cursor-pointer transition-all duration-200 text-left hover:shadow-md",
                          selectedTheme === theme.id
                            ? 'border-blue-500 shadow-md bg-blue-50'
                            : 'border-gray-200 hover:border-gray-400'
                        )}
                      >
                        {/* Mini Preview */}
                        <div
                          className="h-12 rounded-sm mb-2 flex items-center justify-center gap-1"
                          style={{ backgroundColor: theme.colors.primary }}
                        >
                          <div
                            className="w-4 h-4 rounded-sm"
                            style={{ backgroundColor: theme.colors.accent }}
                          />
                          <div
                            className="w-4 h-4 rounded-sm"
                            style={{ backgroundColor: theme.colors.background }}
                          />
                        </div>
                        <div
                          className="h-3 rounded-sm mb-1"
                          style={{ backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}` }}
                        />
                        <div
                          className="h-2 rounded-sm w-2/3"
                          style={{ backgroundColor: theme.colors.border }}
                        />

                        <p className="text-[10px] font-bold mt-1 truncate" style={{ color: theme.colors.text }}>
                          {theme.name}
                        </p>
                        <p className="text-[8px] text-gray-400 truncate">{theme.description}</p>

                        {/* Tags */}
                        <div className="flex gap-1 mt-1">
                          {theme.isDark && (
                            <span className="text-[7px] px-1 py-0.5 rounded bg-gray-800 text-white font-bold">DARK</span>
                          )}
                          {theme.isHighContrast && (
                            <span className="text-[7px] px-1 py-0.5 rounded bg-yellow-400 text-black font-bold">HC</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                {selectedThemeObj && (
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: selectedThemeObj.colors.primary }}
                  />
                )}
                <span className="text-[10px] text-gray-500">
                  Selected: <strong>{selectedThemeObj?.name || 'Current'}</strong>
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-7 text-[11px] rounded-none border-gray-400"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApply}
                  disabled={isApplying || selectedTheme === currentTheme}
                  className="h-7 text-[11px] rounded-none bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {isApplying ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Applying...</>
                  ) : (
                    <><CheckCircle2 className="h-3 w-3 mr-1" /> Apply</>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restart Dialog */}
      <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <DialogContent className="max-w-sm rounded-sm border-gray-400">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-bold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Restart Required
            </DialogTitle>
            <DialogDescription className="text-[11px] text-gray-500">
              Some theme changes require an application restart to apply fully across all components.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 flex items-center justify-center gap-4">
            <Button
              onClick={handleRestartNow}
              className="h-8 text-[11px] rounded-none bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Restart Now
            </Button>
            <Button
              onClick={handleRestartLater}
              variant="outline"
              className="h-8 text-[11px] rounded-none border-gray-400"
            >
              Restart Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
