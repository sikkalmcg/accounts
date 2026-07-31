"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  Mail,
  Phone,
  Globe,
  Clock,
  Calendar,
  Palette,
  ShieldCheck,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Briefcase,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userData: any;
  onSave: (data: any) => void;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { value: 'mr', label: 'मराठी (Marathi)' },
  { value: 'bn', label: 'বাংলা (Bengali)' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'te', label: 'తెలుగు (Telugu)' },
  { value: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { value: 'ml', label: 'മലയാളം (Malayalam)' },
];

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (UTC+4:00)' },
  { value: 'Asia/Riyadh', label: 'Arabia Standard Time (UTC+3:00)' },
  { value: 'Asia/Kathmandu', label: 'Nepal Time (UTC+5:45)' },
  { value: 'Asia/Dhaka', label: 'Bangladesh Standard Time (UTC+6:00)' },
  { value: 'America/New_York', label: 'Eastern Time (UTC-5:00)' },
  { value: 'America/Chicago', label: 'Central Time (UTC-6:00)' },
  { value: 'America/Denver', label: 'Mountain Time (UTC-7:00)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (UTC-8:00)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (UTC+0:00)' },
  { value: 'Europe/Berlin', label: 'Central European Time (UTC+1:00)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (UTC+9:00)' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (UTC+8:00)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (UTC+10:00)' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY' },
  { value: 'DD-MMM-YYYY', label: 'DD-MMM-YYYY' },
];

const TIME_FORMATS = [
  { value: '12h', label: '12-hour (hh:mm:ss AM/PM)' },
  { value: '24h', label: '24-hour (HH:mm:ss)' },
];

export default function UserProfileDialog({ open, onOpenChange, userData, onSave }: UserProfileDialogProps) {
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (userData) {
      setFormData({
        name: userData.name || '',
        employeeId: userData.employeeId || userData.username || '',
        designation: userData.designation || '',
        department: userData.department || '',
        mobile: userData.mobile || '',
        email: userData.email || '',
        preferredLanguage: userData.preferredLanguage || 'en',
        timeZone: userData.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        dateFormat: userData.dateFormat || 'DD/MM/YYYY',
        timeFormat: userData.timeFormat || '12h',
        profilePhoto: userData.profilePhoto || '',
        lastLogin: userData.lastLogin || '',
        accountStatus: userData.accountStatus || 'Active',
        theme: userData.theme || 'Classic',
      });
      setPreviewPhoto(userData.profilePhoto || null);
    }
  }, [userData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Mobile validation (Indian mobile number format)
    if (formData.mobile && !/^[+]?[\d\s()-]{10,15}$/.test(formData.mobile)) {
      newErrors.mobile = 'Invalid mobile number (10-15 digits)';
    }

    // Name validation
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, photo: 'Only JPG, PNG, and JPEG files are allowed' }));
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, photo: 'File size must be less than 2MB' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPreviewPhoto(dataUrl);
      setFormData((prev: any) => ({ ...prev, profilePhoto: dataUrl }));
      setErrors(prev => {
        const { photo, ...rest } = prev;
        return rest;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsSaving(true);
    setShowConfirm(false);

    try {
      // Save to database via API
      const stored = localStorage.getItem('sikka_user');
      if (stored) {
        const user = JSON.parse(stored);
        const response = await fetch('/api/user-profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.username,
            ...formData,
          }),
        });

        if (!response.ok) throw new Error('Failed to save profile');

        // Update localStorage
        const updatedUser = { ...user, ...formData };
        localStorage.setItem('sikka_user', JSON.stringify(updatedUser));

        // Audit log
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.username,
            username: user.name || user.username,
            action: 'UPDATE_PROFILE',
            settingName: 'User Profile',
            previousValue: JSON.stringify(userData),
            newValue: JSON.stringify(formData),
          }),
        }).catch(() => {});

        onSave(updatedUser);

        window.dispatchEvent(new CustomEvent('sap-status', {
          detail: { text: 'Profile updated successfully', level: 'success' },
        }));
      }

      onOpenChange(false);
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('sap-status', {
        detail: { text: `Error: ${err.message}`, isError: true },
      }));
    } finally {
      setIsSaving(false);
    }
  }, [formData, userData, onSave, onOpenChange, showConfirm]);

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && showConfirm) {
        setShowConfirm(false);
      }
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-2xl rounded-sm border-gray-400 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-gray-200 pb-3">
          <DialogTitle className="text-[14px] font-bold uppercase tracking-wider flex items-center gap-2 text-gray-800">
            <User className="h-4 w-4 text-blue-600" />
            User Profile
          </DialogTitle>
          <DialogDescription className="text-[11px] text-gray-500">
            View and update your personal information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Profile Photo */}
          <div className="flex items-center gap-6 p-4 bg-gray-50 border border-gray-200 rounded-sm">
            <div className="relative">
              <Avatar className="h-20 w-20 border-2 border-blue-200">
                {previewPhoto ? (
                  <AvatarImage src={previewPhoto} alt="Profile" />
                ) : (
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xl font-bold">
                    {(formData.name || formData.employeeId || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <label className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-1.5 cursor-pointer hover:bg-blue-700 transition-colors shadow-md">
                <Camera className="h-3.5 w-3.5" />
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-bold text-gray-700">{formData.name || 'User'}</p>
              <p className="text-[10px] text-gray-500">{formData.employeeId}</p>
              {errors.photo && (
                <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.photo}
                </p>
              )}
              <p className="text-[9px] text-gray-400 mt-1">JPG, PNG, JPEG • Max 2MB</p>
            </div>
          </div>

          {/* Read-only Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Hash className="h-3 w-3" /> Employee ID
              </label>
              <div className="sap-input-wrapper">
                <Input
                  value={formData.employeeId}
                  disabled
                  className="bg-gray-100 text-gray-500 cursor-not-allowed h-7 text-[12px]"
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> Designation
              </label>
              <div className="sap-input-wrapper">
                <Input
                  value={formData.designation}
                  disabled
                  className="bg-gray-100 text-gray-500 cursor-not-allowed h-7 text-[12px]"
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Department
              </label>
              <div className="sap-input-wrapper">
                <Input
                  value={formData.department}
                  disabled
                  className="bg-gray-100 text-gray-500 cursor-not-allowed h-7 text-[12px]"
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Palette className="h-3 w-3" /> Theme
              </label>
              <div className="sap-input-wrapper">
                <Input
                  value={formData.theme}
                  disabled
                  className="bg-gray-100 text-gray-500 cursor-not-allowed h-7 text-[12px]"
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Last Login
              </label>
              <div className="sap-input-wrapper">
                <Input
                  value={formData.lastLogin || 'N/A'}
                  disabled
                  className="bg-gray-100 text-gray-500 cursor-not-allowed h-7 text-[12px]"
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Account Status
              </label>
              <div className="sap-input-wrapper">
                <Input
                  value={formData.accountStatus}
                  disabled
                  className="bg-gray-100 text-gray-500 cursor-not-allowed h-7 text-[12px]"
                />
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-3">Editable Information</h3>
          </div>

          {/* Editable Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <User className="h-3 w-3" /> Full Name
              </label>
              <div className="sap-input-wrapper">
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-7 text-[12px]"
                  placeholder="Enter your full name"
                />
                {errors.name && <p className="text-[10px] text-red-600">{errors.name}</p>}
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Phone className="h-3 w-3" /> Mobile Number
              </label>
              <div className="sap-input-wrapper">
                <Input
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="h-7 text-[12px]"
                  placeholder="+91 98765 43210"
                />
                {errors.mobile && <p className="text-[10px] text-red-600">{errors.mobile}</p>}
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email Address
              </label>
              <div className="sap-input-wrapper">
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-7 text-[12px]"
                  placeholder="user@company.com"
                />
                {errors.email && <p className="text-[10px] text-red-600">{errors.email}</p>}
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Globe className="h-3 w-3" /> Preferred Language
              </label>
              <div className="sap-input-wrapper">
                <Select
                  value={formData.preferredLanguage}
                  onValueChange={(v) => setFormData({ ...formData, preferredLanguage: v })}
                >
                  <SelectTrigger className="h-7 rounded-none border-gray-400 text-[12px] focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => (
                      <SelectItem key={l.value} value={l.value} className="text-[12px]">{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Time Zone
              </label>
              <div className="sap-input-wrapper">
                <Select
                  value={formData.timeZone}
                  onValueChange={(v) => setFormData({ ...formData, timeZone: v })}
                >
                  <SelectTrigger className="h-7 rounded-none border-gray-400 text-[12px] focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value} className="text-[12px]">{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Date Format
              </label>
              <div className="sap-input-wrapper">
                <Select
                  value={formData.dateFormat}
                  onValueChange={(v) => setFormData({ ...formData, dateFormat: v })}
                >
                  <SelectTrigger className="h-7 rounded-none border-gray-400 text-[12px] focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map(df => (
                      <SelectItem key={df.value} value={df.value} className="text-[12px]">{df.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Time Format
              </label>
              <div className="sap-input-wrapper">
                <Select
                  value={formData.timeFormat}
                  onValueChange={(v) => setFormData({ ...formData, timeFormat: v })}
                >
                  <SelectTrigger className="h-7 rounded-none border-gray-400 text-[12px] focus:bg-[#fff9c4]">
                    <SelectValue placeholder="Select time format" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_FORMATS.map(tf => (
                      <SelectItem key={tf.value} value={tf.value} className="text-[12px]">{tf.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {showConfirm && (
          <div className="border-t border-gray-200 bg-amber-50 p-3 mb-2">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[12px] font-bold text-amber-800">Confirm Profile Update</p>
                <p className="text-[11px] text-amber-700 mt-1">
                  Are you sure you want to save these changes? All modifications will be recorded in the audit log.
                </p>
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-7 text-[11px] rounded-none bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {isSaving ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</>
                    ) : (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Confirm Save</>
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowConfirm(false)}
                    variant="outline"
                    className="h-7 text-[11px] rounded-none border-gray-400"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between w-full">
            <p className="text-[9px] text-gray-400 italic">Changes are audited and user-specific</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (JSON.stringify(formData) !== JSON.stringify({
                    name: userData?.name || '',
                    employeeId: userData?.employeeId || userData?.username || '',
                    designation: userData?.designation || '',
                    department: userData?.department || '',
                    mobile: userData?.mobile || '',
                    email: userData?.email || '',
                    preferredLanguage: userData?.preferredLanguage || 'en',
                    timeZone: userData?.timeZone || 'Asia/Kolkata',
                    dateFormat: userData?.dateFormat || 'DD/MM/YYYY',
                    timeFormat: userData?.timeFormat || '12h',
                    profilePhoto: userData?.profilePhoto || '',
                    lastLogin: userData?.lastLogin || '',
                    accountStatus: userData?.accountStatus || 'Active',
                    theme: userData?.theme || 'Classic',
                  })) {
                    window.dispatchEvent(new CustomEvent('sap-status', {
                      detail: { text: 'Unsaved changes discarded', level: 'warning' },
                    }));
                  }
                  onOpenChange(false);
                }}
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
                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Save</>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
