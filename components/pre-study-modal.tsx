"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Flashcard } from "@/app/dashboard/page";

export type StudyMode = "all" | "smart";
export type CardLimit = 10 | 25 | 50 | "all";

interface PreStudyModalProps {
  open: boolean;
  onClose: () => void;
  onStart: (mode: StudyMode, limit: CardLimit) => void;
  title: string;
  flashcards: Flashcard[];
}

export function PreStudyModal({
  open,
  onClose,
  onStart,
  title,
  flashcards,
}: PreStudyModalProps) {
  const [mode, setMode] = useState<StudyMode>("smart");
  const [limit, setLimit] = useState<CardLimit>("all");

  // Calculate stats
  const totalCards = flashcards.length;
  const masteredCards = flashcards.filter((f) => f.mastered).length;
  const unmasteredCards = totalCards - masteredCards;
  const needsReviewCards = flashcards.filter(
    (f) => !f.mastered && f.latestRating !== null && f.latestRating <= 2
  ).length;
  const neverStudied = flashcards.filter(
    (f) => !f.mastered && f.latestRating === null
  ).length;
  const dueForReview = flashcards.filter((f) => {
    if (f.mastered || !f.nextReviewAt) return false;
    return new Date(f.nextReviewAt) <= new Date();
  }).length;

  const handleStart = () => {
    onStart(mode, limit);
  };

  const CARD_LIMITS: CardLimit[] = [10, 25, 50, "all"];

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white border-0 rounded-3xl shadow-soft-lg text-[#2C1810] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">{title}</DialogTitle>
          <DialogDescription className="text-[#8B7355]">
            Choose how you want to study
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-4 rounded-2xl bg-[#F5F1E8]">
              <div className="text-[#8B7355] text-xs font-medium uppercase tracking-wide">Available</div>
              <div className="text-3xl font-bold text-[#2C1810] font-serif mt-1">{unmasteredCards}</div>
            </div>
            <div className="p-4 rounded-2xl bg-[#E8F5E9]">
              <div className="text-[#689F38] text-xs font-medium uppercase tracking-wide">Mastered</div>
              <div className="text-3xl font-bold text-[#7CB342] font-serif mt-1">{masteredCards}</div>
            </div>
            {needsReviewCards > 0 && (
              <div className="p-4 rounded-2xl bg-[#FFF8E1]">
                <div className="text-[#F9A825] text-xs font-medium uppercase tracking-wide">Needs Review</div>
                <div className="text-3xl font-bold text-[#FFB74D] font-serif mt-1">{needsReviewCards}</div>
              </div>
            )}
            {dueForReview > 0 && (
              <div className="p-4 rounded-2xl bg-[#FFEBEE]">
                <div className="text-[#E57373] text-xs font-medium uppercase tracking-wide">Due Today</div>
                <div className="text-3xl font-bold text-[#E57373] font-serif mt-1">{dueForReview}</div>
              </div>
            )}
          </div>

          {/* Study Mode */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[#4A3426]">Study Mode</label>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setMode("smart")}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  mode === "smart"
                    ? "border-[#7CB342] bg-[#7CB342]/5"
                    : "border-[#EBE4D6] hover:border-[#D7CFC0] hover:bg-[#F5F1E8]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧠</span>
                  <span className="font-semibold text-[#2C1810]">Smart Study</span>
                  {mode === "smart" && (
                    <span className="ml-auto text-xs bg-[#7CB342] text-white px-3 py-1 rounded-full font-medium">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#8B7355] mt-2 ml-10">
                  Prioritizes weak cards & due for review
                </p>
              </button>

              <button
                onClick={() => setMode("all")}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  mode === "all"
                    ? "border-[#7CB342] bg-[#7CB342]/5"
                    : "border-[#EBE4D6] hover:border-[#D7CFC0] hover:bg-[#F5F1E8]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎲</span>
                  <span className="font-semibold text-[#2C1810]">Study All</span>
                </div>
                <p className="text-sm text-[#8B7355] mt-2 ml-10">
                  Random selection from all cards
                </p>
              </button>
            </div>
          </div>

          {/* Card Count */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[#4A3426]">How many cards?</label>
            <div className="flex gap-2">
              {CARD_LIMITS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLimit(l)}
                  disabled={typeof l === "number" && l > unmasteredCards}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                    limit === l
                      ? "border-[#7CB342] bg-[#7CB342]/10 text-[#689F38]"
                      : "border-[#EBE4D6] text-[#4A3426] hover:border-[#D7CFC0] hover:bg-[#F5F1E8]"
                  } ${
                    typeof l === "number" && l > unmasteredCards
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {l === "all" ? "All" : l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl border-[#D7CFC0] text-[#4A3426] hover:bg-[#F5F1E8]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={unmasteredCards === 0}
            className="flex-1 rounded-xl bg-[#7CB342] hover:bg-[#689F38] text-white font-semibold shadow-soft"
          >
            Start Studying
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
