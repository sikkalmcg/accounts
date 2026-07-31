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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Volume2,
  VolumeX,
  Loader2,
  CheckCircle2,
  Play,
  Upload,
  Music,
  AlertCircle,
  Bell,
  BellOff,
  CheckSquare,
  Maximize2,
  Minimize2,
  MousePointerClick,
  LayoutPanelTop,
  MessageSquare,
  TriangleAlert,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSounds, SoundEvent, SoundSettings, SoundScheme } from "@/hooks/use-sounds";

interface SoundSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userData: any;
}

const EVENT_LABELS: Record<SoundEvent, string> = {
  success: 'Success Message',
  warning: 'Warning Message',
  error: 'Error Message',
  checkbox: 'Checkbox / Radio Button',
  dialog: 'Open Dialog',
  expand: 'Expand / Collapse Tree',
  button_click: 'Button Click',
  tab_switch: 'Switch Tab',
};

const EVENT_ICONS: Record<SoundEvent, React.ReactNode> = {
  success: <CheckCircle className="h-3.5 w-3.5 text-green-600" />,
  warning: <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />,
  error: <XCircle className="h-3.5 w-3.5 text-red-600" />,
  checkbox: <CheckSquare className="h-3.5 w-3.5 text-blue-600" />,
  dialog: <Maximize2 className="h-3.5 w-3.5 text-purple-600" />,
  expand: <Minimize2 className="h-3.5 w-3.5 text-orange-600" />,
  button_click: <MousePointerClick className="h-3.5 w-3.5 text-cyan-600" />,
  tab_switch: <LayoutPanelTop className="h-3.5 w-3.5 text-indigo-600" />,
};

const SOUND_SCHEMES: { value: SoundScheme; label: string }[] = [
  { value: 'sap_countryside', label: 'SAP Countryside' },
  { value: 'sap_classic', label: 'SAP Classic' },
  { value: 'windows_default', label: 'Windows Default' },
  { value: 'no_sound', label: 'No Sound' },
  { value: 'custom', label: 'Custom' },
];

export default function SoundSettingsDialog({ open, onOpenChange, userData }: SoundSettingsDialogProps) {
  const { settings, setSettings, playSound } = useSounds();
  const [localSettings, setLocalSettings] = useState<SoundSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
    }
  }, [open, settings]);

  const handleEnableToggle = (enabled: boolean) => {
    setLocalSettings(prev => ({ ...prev, enabled }));
  };

  const handleSchemeChange = (scheme: SoundScheme) => {
    setLocalSettings(prev => ({ ...prev, scheme }));
  };

const handleCustomSoundUpload = (soundEvent: SoundEvent, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only allow .wav files
    if (!file.name.toLowerCase().endsWith('.wav')) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: 'Only .wav files are supported for custom sounds', isError: true },
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      setLocalSettings(prev => ({
        ...prev,
        scheme: 'custom',
        customSounds: {
          ...prev.customSounds,
          [soundEvent]: dataUrl,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handlePreview = (event: SoundEvent) => {
    // Temporarily set the scheme to preview the sound
    playSound(event);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      setSettings(localSettings);

      // Audit log
      if (userData?.username) {
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userData.username,
            username: userData.name || userData.username,
            action: 'SOUND_CHANGE',
            settingName: 'Sound Settings',
            previousValue: JSON.stringify(settings),
            newValue: JSON.stringify(localSettings),
          }),
        }).catch(() => {});
      }

      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: 'Sound settings saved successfully', level: 'success' },
      }));
      onOpenChange(false);
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Error: ${err.message}`, isError: true },
      }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-sm border-gray-400 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-gray-200 pb-3">
          <DialogTitle className="text-[14px] font-bold uppercase tracking-wider flex items-center gap-2 text-gray-800">
            <Volume2 className="h-4 w-4 text-blue-600" />
            Sound Settings
          </DialogTitle>
          <DialogDescription className="text-[11px] text-gray-500">
            Configure application sound feedback and choose your sound scheme
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Master Enable/Disable */}
          <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-sm">
            <div className="flex items-center gap-3">
              {localSettings.enabled ? (
                <Bell className="h-5 w-5 text-blue-600" />
              ) : (
                <BellOff className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p className="text-[12px] font-bold text-gray-700">Sound Feedback</p>
                <p className="text-[10px] text-gray-500">
                  {localSettings.enabled ? 'All application sounds are enabled' : 'All application sounds are suppressed'}
                </p>
              </div>
            </div>
            <Switch
              checked={localSettings.enabled}
              onCheckedChange={handleEnableToggle}
            />
          </div>

          {/* Sound Scheme Selection */}
          <div className="border border-gray-200 rounded-sm overflow-hidden">
            <div className="bg-[#dae8f5] px-3 py-1 border-b text-[11px] font-bold flex items-center gap-2">
              <Music className="h-3.5 w-3.5" /> Sound Scheme
            </div>
            <div className="p-3">
              <Select
                value={localSettings.scheme}
                onValueChange={(v) => handleSchemeChange(v as SoundScheme)}
                disabled={!localSettings.enabled}
              >
                <SelectTrigger className="h-8 rounded-none border-gray-400 text-[12px] focus:bg-[#fff9c4]">
                  <SelectValue placeholder="Select sound scheme" />
                </SelectTrigger>
                <SelectContent>
                  {SOUND_SCHEMES.map(scheme => (
                    <SelectItem key={scheme.value} value={scheme.value} className="text-[12px]">
                      {scheme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Event Sound Configuration */}
          <div className="border border-gray-200 rounded-sm overflow-hidden">
            <div className="bg-[#dae8f5] px-3 py-1 border-b text-[11px] font-bold flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" /> Event Sounds
            </div>
            <div className="divide-y divide-gray-100">
              {(Object.keys(EVENT_LABELS) as SoundEvent[]).map((event) => (
                <div key={event} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    {EVENT_ICONS[event]}
                    <div>
                      <p className="text-[11px] font-medium text-gray-700">{EVENT_LABELS[event]}</p>
                      <p className="text-[9px] text-gray-400">
                        {localSettings.scheme === 'custom' && localSettings.customSounds?.[event]
                          ? 'Custom sound configured'
                          : localSettings.scheme === 'no_sound' || !localSettings.enabled
                            ? 'No sound'
                            : `Using ${SOUND_SCHEMES.find(s => s.value === localSettings.scheme)?.label || 'default'} sound`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Preview Button */}
                    <button
                      onClick={() => handlePreview(event)}
                      disabled={!localSettings.enabled || localSettings.scheme === 'no_sound'}
                      className="p-1.5 hover:bg-blue-100 rounded text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Preview sound"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>

                    {/* Custom Sound Upload (only for custom scheme) */}
                    {localSettings.scheme === 'custom' && (
                      <label className="p-1.5 hover:bg-green-100 rounded text-green-600 cursor-pointer transition-colors" title="Upload custom .wav file">
                        <Upload className="h-3.5 w-3.5" />
                        <input
                          type="file"
                          accept=".wav"
                          className="hidden"
                          onChange={(e) => handleCustomSoundUpload(event, e)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {localSettings.scheme === 'custom' && (
            <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-100 rounded-sm">
              <AlertCircle className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-[9px] text-blue-700">
                Custom sounds must be .wav files. Upload individual sounds for each event type above.
                Custom sounds are saved in your user profile and restored after login.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between w-full">
            <p className="text-[9px] text-gray-400 italic">Sound settings are user-specific</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-7 text-[11px] rounded-none border-gray-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="h-7 text-[11px] rounded-none bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</>
                ) : (
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Apply</>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
