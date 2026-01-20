"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RatingButtons, getRatingEmoji, getRatingColor } from "@/components/rating-buttons";
import { SessionSummary, type SessionSummaryData } from "@/components/session-summary";
import type { Flashcard } from "@/app/dashboard/page";

interface RatingRecord {
  cardId: string;
  rating: number;
  timeSpentMs: number;
  fileId: string;
  fileName: string;
}

interface FlashcardViewerProps {
  flashcards: Flashcard[];
  showSource?: boolean;
  onRate?: (cardId: string, rating: number, timeSpentMs: number) => Promise<void>;
  onClose: () => void;
  onSessionComplete?: (data: SessionSummaryData) => void;
  onEditFlashcard?: (flashcard: Flashcard) => void;
  onDeleteFlashcard?: (flashcardId: string, preview: string) => void;
}

export function FlashcardViewer({ 
  flashcards, 
  showSource = false,
  onRate,
  onClose,
  onSessionComplete,
  onEditFlashcard,
  onDeleteFlashcard,
}: FlashcardViewerProps) {
  // ALL HOOKS MUST BE AT THE TOP - before any early returns
  
  // Create study queue with reshuffling support - initialize with flashcards directly
  const [studyQueue, setStudyQueue] = useState<Flashcard[]>(() => [...flashcards]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionSummaryData, setSessionSummaryData] = useState<SessionSummaryData | null>(null);
  
  // Session tracking
  const [sessionStartTime] = useState(Date.now());
  const [cardStartTime, setCardStartTime] = useState(Date.now());
  const [sessionRatings, setSessionRatings] = useState<RatingRecord[]>([]);
  const [cardsStudied, setCardsStudied] = useState(0);
  const [cardsMastered, setCardsMastered] = useState(0);
  const [cardsReshuffled, setCardsReshuffled] = useState(0);
  const [studiedCardIds, setStudiedCardIds] = useState<Set<string>>(new Set());
  
  // Elapsed time for timer display - MOVED TO TOP
  const [elapsedTime, setElapsedTime] = useState(0);

  // Sync study queue with flashcards prop
  useEffect(() => {
    if (flashcards.length > 0 && studyQueue.length === 0) {
      setStudyQueue([...flashcards]);
    }
  }, [flashcards, studyQueue.length]);

  // Reset card timer when changing cards
  useEffect(() => {
    setCardStartTime(Date.now());
  }, [currentIndex]);

  // Timer effect - MOVED TO TOP
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - sessionStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Calculate session summary
  const calculateSessionSummary = useCallback((): SessionSummaryData => {
    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: sessionRatings.filter((r) => r.rating === rating).length,
    }));

    const avgRating = sessionRatings.length > 0
      ? sessionRatings.reduce((sum, r) => sum + r.rating, 0) / sessionRatings.length
      : 0;

    // Group ratings by file
    const fileMap = new Map<string, { cardCount: number; totalRating: number; fileName: string }>();
    sessionRatings.forEach((r) => {
      const existing = fileMap.get(r.fileId);
      if (existing) {
        existing.cardCount++;
        existing.totalRating += r.rating;
      } else {
        fileMap.set(r.fileId, { cardCount: 1, totalRating: r.rating, fileName: r.fileName });
      }
    });

    const fileBreakdown = Array.from(fileMap.entries()).map(([fileId, data]) => ({
      fileId,
      fileName: data.fileName,
      cardCount: data.cardCount,
      averageRating: data.totalRating / data.cardCount,
    }));

    return {
      totalCards: flashcards.length,
      cardsStudied,
      cardsMastered,
      cardsReshuffled,
      averageRating: avgRating,
      timeSpentMs: Date.now() - sessionStartTime,
      ratingDistribution,
      fileBreakdown,
    };
  }, [sessionRatings, flashcards.length, cardsStudied, cardsMastered, cardsReshuffled, sessionStartTime]);

  // Handle session completion
  const handleEndSession = useCallback(() => {
    const summary = calculateSessionSummary();
    setSessionSummaryData(summary);
    setSessionComplete(true);
    onSessionComplete?.(summary);
  }, [calculateSessionSummary, onSessionComplete]);

  // Format session time helper
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get current card
  const currentCard = studyQueue[currentIndex];

  // Navigation functions
  const goToPrevious = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : studyQueue.length - 1));
  };

  const goToNext = () => {
    setIsFlipped(false);
    if (currentIndex < studyQueue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleEndSession();
    }
  };

  const handleRate = async (rating: number) => {
    if (!onRate || isRating || !currentCard) return;
    
    const timeSpent = Date.now() - cardStartTime;
    setIsRating(true);

    try {
      await onRate(currentCard.id, rating, timeSpent);
      
      // Track this rating in the session
      setSessionRatings((prev) => [
        ...prev,
        {
          cardId: currentCard.id,
          rating,
          timeSpentMs: timeSpent,
          fileId: currentCard.fileId,
          fileName: currentCard.fileName,
        },
      ]);

      // Track unique cards studied
      if (!studiedCardIds.has(currentCard.id)) {
        setStudiedCardIds((prev) => new Set(prev).add(currentCard.id));
        setCardsStudied((prev) => prev + 1);
      }

      // Check for mastery (rating 5 three times in a row)
      if (rating === 5) {
        const currentConsecutive = (currentCard.consecutiveFives || 0) + 1;
        if (currentConsecutive >= 3) {
          setCardsMastered((prev) => prev + 1);
        }
      }

      // Handle low-rated cards: reshuffle them back into the queue
      if (rating <= 2) {
        setCardsReshuffled((prev) => prev + 1);
        setStudyQueue((prev) => {
          const newQueue = [...prev];
          const remainingCards = newQueue.length - currentIndex - 1;
          if (remainingCards > 3) {
            const insertPosition = currentIndex + 1 + Math.floor(remainingCards * 0.6) + Math.floor(Math.random() * (remainingCards * 0.4));
            newQueue.splice(insertPosition, 0, { ...currentCard });
          } else {
            newQueue.push({ ...currentCard });
          }
          return newQueue;
        });
      }

      // Move to next card
      setTimeout(() => {
        setIsFlipped(false);
        setIsRating(false);
        
        if (currentIndex < studyQueue.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          handleEndSession();
        }
      }, 300);
    } catch (error) {
      console.error("Failed to save rating:", error);
      setIsRating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && !isFlipped) goToPrevious();
    if (e.key === "ArrowRight" && !isFlipped) goToNext();
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!isFlipped) {
        setIsFlipped(true);
      }
    }
    if (e.key === "Escape") {
      handleEndSession();
    }
    if (isFlipped && onRate && !isRating) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 5) {
        handleRate(num);
      }
    }
  };

  const handleStudyAgain = () => {
    setSessionComplete(false);
    setSessionSummaryData(null);
    setCurrentIndex(0);
    setStudyQueue([...flashcards]);
    setSessionRatings([]);
    setCardsStudied(0);
    setCardsMastered(0);
    setCardsReshuffled(0);
    setStudiedCardIds(new Set());
  };

  // ============ RENDER SECTION - early returns are now AFTER all hooks ============

  // Empty flashcards
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
        <h2 className="text-xl font-semibold text-white mb-2">No Flashcards Available</h2>
        <p className="text-slate-400 mb-6">
          All cards may be mastered or there are no flashcards to study.
        </p>
        <Button
          onClick={onClose}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold"
        >
          Go Back
        </Button>
      </div>
    );
  }

  // Show session summary if complete
  if (sessionComplete && sessionSummaryData) {
    return (
      <SessionSummary
        data={sessionSummaryData}
        onStudyAgain={handleStudyAgain}
        onClose={onClose}
      />
    );
  }

  // No current card (queue exhausted or empty)
  if (!currentCard) {
    if (cardsStudied > 0 || sessionRatings.length > 0) {
      // We've studied cards, trigger end session
      // Use setTimeout to avoid calling during render
      setTimeout(handleEndSession, 0);
      return (
        <div className="text-center py-16">
          <p className="text-slate-400">Completing session...</p>
        </div>
      );
    }
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
        <h2 className="text-xl font-semibold text-white mb-2">No Cards to Study</h2>
        <p className="text-slate-400 mb-6">
          All cards may be mastered or filtered out.
        </p>
        <Button
          onClick={onClose}
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold"
        >
          Go Back
        </Button>
      </div>
    );
  }

  // Show all cards view
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
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500">
                      From: {card.fileName}
                    </span>
                    <div className="flex items-center gap-2">
                      {card.mastered && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          🏆 Mastered
                        </span>
                      )}
                      {card.latestRating !== null && (
                        <span 
                          className="text-xs flex items-center gap-1"
                          style={{ color: getRatingColor(card.latestRating) }}
                        >
                          {getRatingEmoji(card.latestRating)} {card.latestRating}/5
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Main study view
  return (
    <div
      className="space-y-6 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Study Session</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(elapsedTime)}
          </span>
          <Button
            variant="outline"
            onClick={() => setShowAll(true)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            View All
          </Button>
          <Button
            variant="outline"
            onClick={handleEndSession}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            End Session
          </Button>
        </div>
      </div>

      {/* Session Stats Bar */}
      <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Studied:</span>
          <span className="text-sm font-medium text-white">{cardsStudied}</span>
        </div>
        {cardsMastered > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-emerald-400">🏆 Mastered:</span>
            <span className="text-sm font-medium text-emerald-400">{cardsMastered}</span>
          </div>
        )}
        {cardsReshuffled > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-amber-400">🔄 Reviewing:</span>
            <span className="text-sm font-medium text-amber-400">{cardsReshuffled}</span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / studyQueue.length) * 100}%`,
            }}
          />
        </div>
        <span className="text-sm text-slate-400 tabular-nums">
          {currentIndex + 1} / {studyQueue.length}
        </span>
      </div>

      {/* Flashcard */}
      <div className="perspective-1000">
        <div
          onClick={() => !isFlipped && setIsFlipped(true)}
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-amber-400">
                  Question
                </span>
                {/* Source badge */}
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  currentCard.source === "manual" 
                    ? "bg-purple-500/20 text-purple-400" 
                    : "bg-blue-500/20 text-blue-400"
                }`}>
                  {currentCard.source === "manual" ? "✏️ Manual" : "🤖 AI"}
                  {currentCard.isEdited && " • Edited"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentCard.mastered && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    🏆 Mastered
                  </span>
                )}
                {currentCard.latestRating !== null && (
                  <span 
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded-full"
                    style={{ 
                      color: getRatingColor(currentCard.latestRating),
                      backgroundColor: `${getRatingColor(currentCard.latestRating)}20`
                    }}
                  >
                    {getRatingEmoji(currentCard.latestRating)} {currentCard.latestRating}/5
                    {currentCard.ratingCount > 1 && (
                      <span className="text-slate-500 ml-1">
                        ({currentCard.ratingCount}x)
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xl text-white text-center leading-relaxed">
                {currentCard.question}
              </p>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500 mt-4 pt-4 border-t border-slate-700">
              <span>Click or press Space to flip</span>
              {showSource && (
                <span className="truncate max-w-[200px]">📄 {currentCard.fileName}</span>
              )}
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
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider text-emerald-400">
                Answer
              </span>
              {/* Edit/Delete buttons */}
              <div className="flex items-center gap-1">
                {onEditFlashcard && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditFlashcard(currentCard);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    title="Edit flashcard"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
                {onDeleteFlashcard && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFlashcard(currentCard.id, currentCard.question);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete flashcard"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xl text-white text-center leading-relaxed">
                {currentCard.answer}
              </p>
            </div>
            {showSource && (
              <div className="text-xs text-slate-500 mt-2 text-center">
                📄 {currentCard.fileName}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons (shown when flipped) */}
      {isFlipped && onRate && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <RatingButtons onRate={handleRate} disabled={isRating} />
          <p className="text-center text-xs text-slate-500 mt-2">
            Press 1-5 to rate quickly • Low ratings (1-2) will repeat this session
          </p>
        </div>
      )}

      {/* Navigation (shown when not flipped or no rating) */}
      {(!isFlipped || !onRate) && (
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
            onClick={() => setIsFlipped(true)}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold"
          >
            Flip Card
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={goToNext}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Skip
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
      )}

      <p className="text-center text-sm text-slate-500">
        {isFlipped 
          ? "Rate your confidence, then continue" 
          : "Use arrow keys to navigate, Space to flip, Esc to end"
        }
      </p>
    </div>
  );
}
