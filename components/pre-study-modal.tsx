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
      <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Choose how you want to study
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-slate-700/50">
              <div className="text-slate-400">Available</div>
              <div className="text-2xl font-bold text-white">{unmasteredCards}</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-emerald-400">Mastered</div>
              <div className="text-2xl font-bold text-emerald-400">{masteredCards}</div>
            </div>
            {needsReviewCards > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="text-amber-400">Needs Review</div>
                <div className="text-2xl font-bold text-amber-400">{needsReviewCards}</div>
              </div>
            )}
            {dueForReview > 0 && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-red-400">Due Today</div>
                <div className="text-2xl font-bold text-red-400">{dueForReview}</div>
              </div>
            )}
          </div>

          {/* Study Mode */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">Study Mode</label>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setMode("smart")}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  mode === "smart"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-slate-600 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧠</span>
                  <span className="font-medium">Smart Study</span>
                  {mode === "smart" && (
                    <span className="ml-auto text-xs bg-amber-500 text-slate-900 px-2 py-0.5 rounded-full">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Prioritizes weak cards & due for review
                </p>
              </button>

              <button
                onClick={() => setMode("all")}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  mode === "all"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-slate-600 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎲</span>
                  <span className="font-medium">Study All</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Random selection from all cards
                </p>
              </button>
            </div>
          </div>

          {/* Card Count */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-300">How many cards?</label>
            <div className="flex gap-2">
              {CARD_LIMITS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLimit(l)}
                  disabled={typeof l === "number" && l > unmasteredCards}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                    limit === l
                      ? "border-amber-500 bg-amber-500/10 text-amber-400"
                      : "border-slate-600 text-slate-300 hover:border-slate-500"
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
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={unmasteredCards === 0}
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold"
          >
            Start Studying
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

