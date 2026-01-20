"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  itemPreview?: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
}

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  itemPreview,
  confirmLabel = "Delete",
  variant = "danger",
}: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <span className={variant === "danger" ? "text-red-400" : "text-amber-400"}>
              ⚠️
            </span>
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {itemPreview && (
            <div className="p-4 rounded-lg bg-slate-700/50 border border-slate-600">
              <p className="text-white text-center">&quot;{itemPreview}&quot;</p>
            </div>
          )}

          <p className="text-sm text-slate-400 mt-4 text-center">
            This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={deleting}
            className={`flex-1 font-semibold ${
              variant === "danger"
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-slate-900"
            }`}
          >
            {deleting ? "Deleting..." : `🗑️ ${confirmLabel}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

