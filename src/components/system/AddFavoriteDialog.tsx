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
import { Input } from "@/components/ui/input";
import { Star, Loader2, AlertCircle, Plus } from "lucide-react";
import { getTcodeTitle, isValidTcode } from "@/lib/tcode-metadata";
import { playGlobalSound } from "@/hooks/use-sounds";

interface AddFavoriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userData: any;
  onFavoriteAdded?: () => void;
}

export default function AddFavoriteDialog({
  open,
  onOpenChange,
  userData,
  onFavoriteAdded,
}: AddFavoriteDialogProps) {
  const [tcode, setTcode] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Auto-fetch description whenever tcode changes
  useEffect(() => {
    const trimmed = tcode.trim().toUpperCase();
    if (trimmed) {
      const desc = getTcodeTitle(trimmed);
      if (desc) {
        setDescription(desc);
        setError("");
      } else {
        setDescription("");
      }
    } else {
      setDescription("");
      setError("");
    }
  }, [tcode]);

  const handleClose = () => {
    if (!isSaving) {
      setTcode("");
      setDescription("");
      setError("");
      onOpenChange(false);
    }
  };

  const handleAdd = async () => {
    setError("");
    const trimmed = tcode.trim().toUpperCase();

    if (!trimmed) {
      setError("Please enter a T-Code.");
      playGlobalSound("error");
      return;
    }

    if (!isValidTcode(trimmed)) {
      setError("Invalid T-Code. Please enter a valid T-Code.");
      playGlobalSound("error");
      return;
    }

    const currentUserId = userData?.username;
    if (!currentUserId) {
      setError("User session not found.");
      playGlobalSound("error");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          tcode: trimmed,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || "Failed to add favorite";
        setError(errorMsg);
        playGlobalSound("error");
        return;
      }

      playGlobalSound("success");
      window.dispatchEvent(new CustomEvent("favorites-updated", { detail: { tcode: trimmed, action: "add" } }));
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: `T-Code [${trimmed}] added to Favorites`, level: "success" },
        })
      );

      if (onFavoriteAdded) {
        onFavoriteAdded();
      }

      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to add favorite");
      playGlobalSound("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-sm border-gray-400">
        <DialogHeader className="border-b border-gray-200 pb-3">
          <DialogTitle className="text-[14px] font-bold uppercase tracking-wider flex items-center gap-2 text-gray-800">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            Add Favorite
          </DialogTitle>
          <DialogDescription className="text-[11px] text-gray-500">
            Add a transaction code to your dashboard favorites
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-sm">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600">T-Code</label>
              <div className="sap-input-wrapper">
                <Input
                  value={tcode}
                  onChange={(e) => {
                    setTcode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  placeholder="e.g. FB03, VF01, MIGO"
                  className="h-7 text-[12px] uppercase font-mono"
                  autoFocus
                />
              </div>
            </div>

            <div className="sap-selection-row">
              <label className="sap-label text-[11px] font-bold text-gray-600">Description</label>
              <div className="sap-input-wrapper">
                <Input
                  value={description}
                  readOnly
                  disabled
                  placeholder="Auto-fetched description..."
                  className="h-7 text-[12px] bg-gray-100 text-gray-700 font-semibold cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between w-full">
            <p className="text-[9px] text-gray-400 italic">Favorites are stored user-wise</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSaving}
                className="h-7 text-[11px] rounded-none border-gray-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={isSaving}
                className="h-7 text-[11px] rounded-none bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Adding...</>
                ) : (
                  <><Plus className="h-3 w-3 mr-1" /> Add</>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
