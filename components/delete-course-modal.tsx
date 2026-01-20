"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Course, FileDocument, Flashcard } from "@/app/dashboard/page";

interface DeleteCourseModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  course: Course | null;
  files: FileDocument[];
  flashcards: Flashcard[];
}

export function DeleteCourseModal({
  open,
  onClose,
  onConfirm,
  course,
  files,
  flashcards,
}: DeleteCourseModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // Calculate what will be deleted
  const courseFiles = files.filter((f) => f.courseId === course?.id);
  const courseFlashcards = flashcards.filter((f) => f.courseId === course?.id);
  const masteredCards = courseFlashcards.filter((f) => f.mastered).length;

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setDeleting(false);
      setProgress(null);
    }
  }, [open]);

  const handleConfirm = async () => {
    setDeleting(true);
    setProgress("Preparing deletion...");
    try {
      await onConfirm();
    } catch (error) {
      console.error("Delete failed:", error);
      setDeleting(false);
      setProgress(null);
    }
  };

  if (!course) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && !deleting && onClose()}>
      <DialogContent className="bg-white border-0 rounded-3xl shadow-soft-lg text-[#2C1810] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif flex items-center gap-2">
            <span className="text-[#E57373]">⚠️</span>
            Delete Course?
          </DialogTitle>
          <DialogDescription className="text-[#8B7355]">
            This will permanently delete the course and all its contents.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Course preview */}
          <div className="p-4 rounded-2xl bg-[#F5F1E8] flex items-center gap-3">
            <span className="text-2xl">{course.emoji}</span>
            <span className="text-[#2C1810] font-semibold text-lg">{course.name}</span>
          </div>

          {/* What will be deleted */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#4A3426]">This will permanently delete:</p>
            <div className="p-4 rounded-2xl bg-[#FFEBEE] space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#4A3426] flex items-center gap-2">
                  <span>📄</span> Files
                </span>
                <span className="font-semibold text-[#E57373]">{courseFiles.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#4A3426] flex items-center gap-2">
                  <span>🃏</span> Flashcards
                </span>
                <span className="font-semibold text-[#E57373]">{courseFlashcards.length}</span>
              </div>
              {masteredCards > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#4A3426] flex items-center gap-2">
                    <span>🏆</span> Mastered cards
                  </span>
                  <span className="font-semibold text-[#E57373]">{masteredCards}</span>
                </div>
              )}
            </div>
          </div>

          {/* Note about ratings */}
          <p className="text-xs text-[#8B7355] flex items-center gap-1">
            <span>ℹ️</span>
            Study progress history will be kept for analytics.
          </p>

          {/* Progress indicator */}
          {deleting && progress && (
            <div className="p-4 rounded-2xl bg-[#FFF8E1] flex items-center gap-3">
              <svg className="w-5 h-5 animate-spin text-[#F9A825]" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm text-[#F9A825] font-medium">{progress}</span>
            </div>
          )}

          {!deleting && (
            <p className="text-sm text-[#E57373] text-center font-medium">
              ⚠️ This action cannot be undone.
            </p>
          )}
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
            className="flex-1 rounded-xl bg-[#E57373] hover:bg-[#EF5350] text-white font-semibold"
          >
            {deleting ? "Deleting..." : "🗑️ Delete Course"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

