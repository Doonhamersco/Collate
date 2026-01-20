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
      <DialogContent className="bg-white border-0 rounded-3xl shadow-soft-lg text-[#2C1810] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif flex items-center gap-2">
            <span className={variant === "danger" ? "text-[#E57373]" : "text-[#FFB74D]"}>
              ⚠️
            </span>
            {title}
          </DialogTitle>
          <DialogDescription className="text-[#8B7355]">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {itemPreview && (
            <div className="p-5 rounded-2xl bg-[#F5F1E8]">
              <p className="text-[#2C1810] text-center font-medium">&quot;{itemPreview}&quot;</p>
            </div>
          )}

          <p className="text-sm text-[#8B7355] mt-4 text-center">
            This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-xl border-[#D7CFC0] text-[#4A3426] hover:bg-[#F5F1E8]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={deleting}
            className={`flex-1 rounded-xl font-semibold ${
              variant === "danger"
                ? "bg-[#E57373] hover:bg-[#EF5350] text-white"
                : "bg-[#FFB74D] hover:bg-[#FFA726] text-[#2C1810]"
            }`}
          >
            {deleting ? "Deleting..." : `🗑️ ${confirmLabel}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
