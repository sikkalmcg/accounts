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
import { Trash2, Loader2, AlertCircle } from "lucide-react";
import { getTcodeTitle } from "@/lib/tcode-metadata";
import { playGlobalSound } from "@/hooks/use-sounds";

interface RemoveFavoriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userData: any;
  onFavoriteRemoved?: () => void;
}

export default function RemoveFavoriteDialog({
  open,
  onOpenChange,
  userData,
  onFavoriteRemoved,
}: RemoveFavoriteDialogProps) {
  const [tcode, setTcode] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isRemoving, setIsRemoving] = useState(false);

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
    if (!isRemoving) {
      setTcode("");
      setDescription("");
      setError("");
      onOpenChange(false);
    }
  };

  const handleRemove = async () => {
    setError("");
    const trimmed = tcode.trim().toUpperCase();

    if (!trimmed) {
      setError("Please enter a T-Code.");
      playGlobalSound("error");
      return;
    }

    const currentUserId = userData?.username;
    if (!currentUserId) {
      setError("User session not found.");
      playGlobalSound("error");
      return;
    }

    setIsRemoving(true);

    try {
      const response = await fetch(
        `/api/favorites?userId=${encodeURIComponent(currentUserId)}&tcode=${encodeURIComponent(trimmed)}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || "Failed to remove favorite";
        setError(errorMsg);
        playGlobalSound("error");
        return;
      }

      playGlobalSound("success");
      window.dispatchEvent(new CustomEvent("favorites-updated", { detail: { tcode: trimmed, action: "remove" } }));
      window.dispatchEvent(
        new CustomEvent("sap-status", {
          detail: { text: `T-Code [${trimmed}] removed from Favorites`, level: "success" },
        })
      );

      if (onFavoriteRemoved) {
        onFavoriteRemoved();
      }

      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to remove favorite");
      playGlobalSound("error");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-sm border-gray-400">
        <DialogHeader className="border-b border-gray-200 pb-3">
          <DialogTitle className="text-[14px] font-bold uppercase tracking-wider flex items-center gap-2 text-gray-800">
            <Trash2 className="h-4 w-4 text-red-600" />
            Remove Favorite
          </DialogTitle>
          <DialogDescription className="text-[11px] text-gray-500">
            Remove a transaction code from your dashboard favorites
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
                      handleRemove();
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
            <p className="text-[9px] text-gray-400 italic">Removes only from your favorites</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isRemoving}
                className="h-7 text-[11px] rounded-none border-gray-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRemove}
                disabled={isRemoving}
                className="h-7 text-[11px] rounded-none bg-red-600 hover:bg-red-700 text-white"
              >
                {isRemoving ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Removing...</>
                ) : (
                  <><Trash2 className="h-3 w-3 mr-1" /> Remove</>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
