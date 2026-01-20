"use client";

import { Button } from "@/components/ui/button";
import { getRatingColor, getRatingEmoji } from "@/components/rating-buttons";

interface RatingDistribution {
  rating: number;
  count: number;
}

interface FileBreakdown {
  fileId: string;
  fileName: string;
  cardCount: number;
  averageRating: number;
}

export interface SessionSummaryData {
  totalCards: number;
  cardsStudied: number;
  cardsMastered: number;
  cardsReshuffled: number;
  averageRating: number;
  timeSpentMs: number;
  ratingDistribution: RatingDistribution[];
  fileBreakdown: FileBreakdown[];
}

interface SessionSummaryProps {
  data: SessionSummaryData;
  onStudyAgain: () => void;
  onClose: () => void;
}

export function SessionSummary({ data, onStudyAgain, onClose }: SessionSummaryProps) {
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const masteryPercentage = data.averageRating 
    ? Math.round(((data.averageRating - 1) / 4) * 100) 
    : 0;

  const RATING_LABELS = [
    { value: 1, emoji: "😫", label: "Didn't know" },
    { value: 2, emoji: "😕", label: "Struggled" },
    { value: 3, emoji: "😐", label: "Okay" },
    { value: 4, emoji: "😊", label: "Good" },
    { value: 5, emoji: "🎯", label: "Perfect" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="text-7xl mb-4">🎉</div>
        <h2 className="text-3xl font-serif font-bold text-[#2C1810] mb-2">Session Complete!</h2>
        <p className="text-[#8B7355] text-lg">
          You studied {data.cardsStudied} flashcards in {formatTime(data.timeSpentMs)}
        </p>
      </div>

      {/* Average Rating */}
      <div className="p-8 rounded-3xl bg-white shadow-soft text-center">
        <div className="text-sm text-[#8B7355] mb-2 font-medium uppercase tracking-wide">Average Rating</div>
        <div className="text-5xl font-bold text-[#2C1810] mb-3 font-serif">
          {data.averageRating.toFixed(1)} / 5.0
        </div>
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`text-3xl ${
                star <= Math.round(data.averageRating) ? "opacity-100" : "opacity-30"
              }`}
            >
              ⭐
            </span>
          ))}
        </div>
        <div className="w-full h-4 bg-[#EBE4D6] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#7CB342] transition-all duration-500 rounded-full"
            style={{ width: `${masteryPercentage}%` }}
          />
        </div>
        <div className="text-sm text-[#8B7355] mt-3 font-medium">{masteryPercentage}% mastery</div>
      </div>

      {/* Rating Distribution */}
      <div className="p-6 rounded-3xl bg-white shadow-soft">
        <h3 className="text-lg font-serif font-semibold text-[#2C1810] mb-5 flex items-center gap-2">
          <span>📊</span> Rating Distribution
        </h3>
        <div className="space-y-4">
          {RATING_LABELS.map((ratingInfo) => {
            const ratingData = data.ratingDistribution.find(
              (r) => r.rating === ratingInfo.value
            );
            const count = ratingData?.count || 0;
            const percentage = data.cardsStudied > 0 
              ? (count / data.cardsStudied) * 100 
              : 0;

            return (
              <div key={ratingInfo.value} className="flex items-center gap-4">
                <span className="w-28 text-sm flex items-center gap-2">
                  <span className="text-xl">{ratingInfo.emoji}</span>
                  <span className="text-[#4A3426] font-medium">{ratingInfo.label}</span>
                </span>
                <div className="flex-1 h-6 bg-[#F5F1E8] rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-500 rounded-full"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: getRatingColor(ratingInfo.value),
                    }}
                  />
                </div>
                <span className="w-24 text-sm text-[#8B7355] text-right font-medium">
                  {count} ({Math.round(percentage)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* File Breakdown */}
      {data.fileBreakdown.length > 1 && (
        <div className="p-6 rounded-3xl bg-white shadow-soft">
          <h3 className="text-lg font-serif font-semibold text-[#2C1810] mb-5 flex items-center gap-2">
            <span>📁</span> Breakdown by File
          </h3>
          <div className="space-y-3">
            {data.fileBreakdown.map((file) => (
              <div
                key={file.fileId}
                className="flex items-center justify-between p-4 rounded-2xl bg-[#F5F1E8]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[#2C1810] font-medium truncate">{file.fileName || "Manual Cards"}</div>
                  <div className="text-sm text-[#8B7355]">{file.cardCount} cards</div>
                </div>
                <div
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold"
                  style={{
                    backgroundColor: `${getRatingColor(Math.round(file.averageRating))}15`,
                    color: getRatingColor(Math.round(file.averageRating)),
                  }}
                >
                  <span>{getRatingEmoji(Math.round(file.averageRating))}</span>
                  <span>{file.averageRating.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {(data.cardsMastered > 0 || data.cardsReshuffled > 0) && (
        <div className="p-6 rounded-3xl bg-white shadow-soft">
          <h3 className="text-lg font-serif font-semibold text-[#2C1810] mb-4">Session Highlights</h3>
          <div className="flex flex-wrap gap-3">
            {data.cardsMastered > 0 && (
              <div className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#E8F5E9] text-[#689F38] font-medium">
                <span className="text-xl">🏆</span>
                <span>{data.cardsMastered} cards mastered!</span>
              </div>
            )}
            {data.cardsReshuffled > 0 && (
              <div className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#FFF8E1] text-[#F9A825] font-medium">
                <span className="text-xl">🔄</span>
                <span>{data.cardsReshuffled} cards reviewed again</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={onClose}
          className="flex-1 h-12 rounded-2xl border-[#D7CFC0] text-[#4A3426] hover:bg-[#F5F1E8]"
        >
          Back to Dashboard
        </Button>
        <Button
          onClick={onStudyAgain}
          className="flex-1 h-12 rounded-2xl bg-[#7CB342] hover:bg-[#689F38] text-white font-semibold shadow-soft"
        >
          Study Again
        </Button>
      </div>
    </div>
  );
}
