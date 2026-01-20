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
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-white mb-2">Session Complete!</h2>
        <p className="text-slate-400">
          You studied {data.cardsStudied} flashcards in {formatTime(data.timeSpentMs)}
        </p>
      </div>

      {/* Average Rating */}
      <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 text-center">
        <div className="text-sm text-slate-400 mb-2">Average Rating</div>
        <div className="text-4xl font-bold text-white mb-2">
          {data.averageRating.toFixed(1)} / 5.0
        </div>
        <div className="flex justify-center gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`text-2xl ${
                star <= Math.round(data.averageRating) ? "opacity-100" : "opacity-30"
              }`}
            >
              ⭐
            </span>
          ))}
        </div>
        <div className="w-full h-4 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
            style={{ width: `${masteryPercentage}%` }}
          />
        </div>
        <div className="text-sm text-slate-400 mt-2">{masteryPercentage}% mastery</div>
      </div>

      {/* Rating Distribution */}
      <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>📊</span> Rating Distribution
        </h3>
        <div className="space-y-3">
          {RATING_LABELS.map((ratingInfo) => {
            const ratingData = data.ratingDistribution.find(
              (r) => r.rating === ratingInfo.value
            );
            const count = ratingData?.count || 0;
            const percentage = data.cardsStudied > 0 
              ? (count / data.cardsStudied) * 100 
              : 0;

            return (
              <div key={ratingInfo.value} className="flex items-center gap-3">
                <span className="w-24 text-sm flex items-center gap-1">
                  <span>{ratingInfo.emoji}</span>
                  <span className="text-slate-400">{ratingInfo.label}</span>
                </span>
                <div className="flex-1 h-6 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: getRatingColor(ratingInfo.value),
                    }}
                  />
                </div>
                <span className="w-20 text-sm text-slate-400 text-right">
                  {count} ({Math.round(percentage)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* File Breakdown */}
      {data.fileBreakdown.length > 1 && (
        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>📁</span> Breakdown by File
          </h3>
          <div className="space-y-3">
            {data.fileBreakdown.map((file) => (
              <div
                key={file.fileId}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-white truncate">{file.fileName}</div>
                  <div className="text-sm text-slate-400">{file.cardCount} cards</div>
                </div>
                <div
                  className="flex items-center gap-1 px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: `${getRatingColor(Math.round(file.averageRating))}20`,
                    color: getRatingColor(Math.round(file.averageRating)),
                  }}
                >
                  <span>{getRatingEmoji(Math.round(file.averageRating))}</span>
                  <span className="font-medium">{file.averageRating.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {(data.cardsMastered > 0 || data.cardsReshuffled > 0) && (
        <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Session Highlights</h3>
          <div className="flex gap-4">
            {data.cardsMastered > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-400">
                <span>🏆</span>
                <span>{data.cardsMastered} cards mastered!</span>
              </div>
            )}
            {data.cardsReshuffled > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 text-amber-400">
                <span>🔄</span>
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
          className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          Back to Dashboard
        </Button>
        <Button
          onClick={onStudyAgain}
          className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold"
        >
          Study Again
        </Button>
      </div>
    </div>
  );
}

