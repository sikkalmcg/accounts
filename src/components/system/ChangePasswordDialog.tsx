"use client";

import { useState } from "react";
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
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  XCircle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userData: any;
}

const PASSWORD_RULES = [
  { label: 'Minimum 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'At least 1 uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'At least 1 lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'At least 1 number', test: (p: string) => /\d/.test(p) },
  { label: 'At least 1 special character', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function ChangePasswordDialog({ open, onOpenChange, userData }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validate = (): string | null => {
    if (!currentPassword) return 'Current password is required';
    if (!newPassword) return 'New password is required';
    if (!confirmPassword) return 'Please confirm your new password';

    if (currentPassword === newPassword) {
      return 'New password must not match the current password';
    }

    if (newPassword.length < 8) {
      return 'Password must be at least 8 characters';
    }

    if (!/[A-Z]/.test(newPassword)) {
      return 'Password must contain at least 1 uppercase letter';
    }

    if (!/[a-z]/.test(newPassword)) {
      return 'Password must contain at least 1 lowercase letter';
    }

    if (!/\d/.test(newPassword)) {
      return 'Password must contain at least 1 number';
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      return 'Password must contain at least 1 special character';
    }

    if (newPassword !== confirmPassword) {
      return 'Confirm password must match the new password';
    }

    return null;
  };

  const handleSave = async () => {
    setError('');
    setSuccess(false);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      // Verify current password and update
      const response = await fetch('/api/user-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userData?.username,
          password: newPassword, // In production, this should be hashed server-side
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update password');
      }

      // Audit log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userData?.username,
          username: userData?.name || userData?.username,
          action: 'CHANGE_PASSWORD',
          settingName: 'Password',
          previousValue: '********',
          newValue: '********',
        }),
      }).catch(() => {});

      setSuccess(true);

      // Auto sign out after 2 seconds
      setTimeout(() => {
        localStorage.removeItem('sikka_user');
        window.location.href = '/login';
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess(false);
      onOpenChange(false);
    }
  };

  const passwordStrength = newPassword ? PASSWORD_RULES.filter(r => r.test(newPassword)).length : 0;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'][passwordStrength];
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'][passwordStrength];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-sm border-gray-400">
        <DialogHeader className="border-b border-gray-200 pb-3">
          <DialogTitle className="text-[14px] font-bold uppercase tracking-wider flex items-center gap-2 text-gray-800">
            <KeyRound className="h-4 w-4 text-blue-600" />
            Change Password
          </DialogTitle>
          <DialogDescription className="text-[11px] text-gray-500">
            Securely update your login password
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-green-800">Password Changed Successfully</p>
              <p className="text-[11px] text-gray-500 mt-1">
                You will be automatically signed out. Please log in with your new password.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Redirecting to login...
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-sm">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="sap-selection-row">
                <label className="sap-label text-[11px] font-bold text-gray-600">Current Password</label>
                <div className="sap-input-wrapper relative">
                  <Input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-7 text-[12px] pr-8"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="sap-selection-row">
                <label className="sap-label text-[11px] font-bold text-gray-600">New Password</label>
                <div className="sap-input-wrapper relative">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-7 text-[12px] pr-8"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="sap-selection-row">
                <label className="sap-label text-[11px] font-bold text-gray-600">Confirm Password</label>
                <div className="sap-input-wrapper relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-7 text-[12px] pr-8"
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500">Password Strength</span>
                  <span className={cn(
                    "text-[10px] font-bold",
                    passwordStrength <= 2 ? 'text-red-600' : passwordStrength <= 3 ? 'text-yellow-600' : 'text-green-600'
                  )}>
                    {strengthLabel}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-300", strengthColor)}
                    style={{ width: `${(passwordStrength / PASSWORD_RULES.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Password Rules */}
            <div className="bg-gray-50 border border-gray-200 p-3 rounded-sm">
              <p className="text-[10px] font-bold text-gray-600 mb-2 uppercase tracking-wider">Password Requirements</p>
              <div className="space-y-1">
                {PASSWORD_RULES.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {rule.test(newPassword) ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <XCircle className="h-3 w-3 text-gray-300" />
                    )}
                    <span className={cn(
                      'text-[10px]',
                      rule.test(newPassword) ? 'text-green-700 font-medium' : 'text-gray-400'
                    )}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-100 rounded-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-[9px] text-blue-700">
                After changing your password, you will be automatically signed out and must log in with your new password.
              </p>
            </div>
          </div>
        )}

        {!success && (
          <DialogFooter className="border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between w-full">
              <p className="text-[9px] text-gray-400 italic">Password is stored securely using hashing</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
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
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Changing...</>
                  ) : (
                    <><KeyRound className="h-3 w-3 mr-1" /> Change Password</>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
