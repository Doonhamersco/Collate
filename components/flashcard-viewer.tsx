"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Flashcard } from "@/app/dashboard/page";

interface FlashcardViewerProps {
  flashcards: Flashcard[];
  onClose: () => void;
}

export function FlashcardViewer({ flashcards, onClose }: FlashcardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-700 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No Flashcards Yet</h2>
        <p className="text-slate-400 mb-6">
          Generate flashcards from your uploaded PDFs to start studying
        </p>
        <Button
          onClick={onClose}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold"
        >
          Go to Files
        </Button>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  const goToPrevious = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : flashcards.length - 1));
  };

  const goToNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev < flashcards.length - 1 ? prev + 1 : 0));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") goToPrevious();
    if (e.key === "ArrowRight") goToNext();
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setIsFlipped(!isFlipped);
    }
  };

  if (showAll) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            All Flashcards ({flashcards.length})
          </h2>
          <Button
            variant="outline"
            onClick={() => setShowAll(false)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Study Mode
          </Button>
        </div>
        <div className="grid gap-4">
          {flashcards.map((card, index) => (
            <div
              key={card.id}
              className="p-6 rounded-xl bg-slate-800/50 border border-slate-700"
            >
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="flex-1 space-y-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
                      Question
                    </span>
                    <p className="text-white">{card.question}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-500 mb-1 block">
                      Answer
                    </span>
                    <p className="text-slate-300">{card.answer}</p>
                  </div>
                  <div className="pt-2">
                    <span className="text-xs text-slate-500">
                      From: {card.fileName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Study Flashcards</h2>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowAll(true)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            View All
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / flashcards.length) * 100}%`,
            }}
          />
        </div>
        <span className="text-sm text-slate-400 tabular-nums">
          {currentIndex + 1} / {flashcards.length}
        </span>
      </div>

      {/* Flashcard */}
      <div className="perspective-1000">
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className={`
            relative w-full min-h-[300px] cursor-pointer transition-transform duration-500 transform-style-preserve-3d
            ${isFlipped ? "rotate-y-180" : ""}
          `}
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front (Question) */}
          <div
            className="absolute inset-0 p-8 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex flex-col backface-hidden"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="text-xs uppercase tracking-wider text-amber-400 mb-4">
              Question
            </span>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xl text-white text-center leading-relaxed">
                {currentCard.question}
              </p>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500 mt-4 pt-4 border-t border-slate-700">
              <span>Click or press Space to flip</span>
              <span className="truncate max-w-[200px]">{currentCard.fileName}</span>
            </div>
          </div>

          {/* Back (Answer) */}
          <div
            className="absolute inset-0 p-8 rounded-2xl bg-gradient-to-br from-emerald-900/50 to-slate-900 border border-emerald-700/50 flex flex-col backface-hidden rotate-y-180"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <span className="text-xs uppercase tracking-wider text-emerald-400 mb-4">
              Answer
            </span>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xl text-white text-center leading-relaxed">
                {currentCard.answer}
              </p>
            </div>
            <div className="flex items-center justify-center text-sm text-slate-500 mt-4 pt-4 border-t border-emerald-700/30">
              <span>Click or press Space to flip back</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="lg"
          onClick={goToPrevious}
          className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Previous
        </Button>
        <Button
          size="lg"
          onClick={goToNext}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold"
        >
          Next
          <svg
            className="w-5 h-5 ml-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Button>
      </div>

      <p className="text-center text-sm text-slate-500">
        Use arrow keys to navigate, Space or Enter to flip
      </p>
    </div>
  );
}

