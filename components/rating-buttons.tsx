"use client";

import { useState } from "react";

const RATING_CONFIG = [
  { value: 1, emoji: "😫", label: "Didn't know", color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.2)" },
  { value: 2, emoji: "😕", label: "Struggled", color: "#f97316", bgColor: "rgba(249, 115, 22, 0.2)" },
  { value: 3, emoji: "😐", label: "Okay", color: "#eab308", bgColor: "rgba(234, 179, 8, 0.2)" },
  { value: 4, emoji: "😊", label: "Good", color: "#84cc16", bgColor: "rgba(132, 204, 22, 0.2)" },
  { value: 5, emoji: "🎯", label: "Perfect", color: "#22c55e", bgColor: "rgba(34, 197, 94, 0.2)" },
];

interface RatingButtonsProps {
  onRate: (rating: number) => void;
  disabled?: boolean;
}

export function RatingButtons({ onRate, disabled }: RatingButtonsProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleRate = (rating: number) => {
    if (disabled || isAnimating) return;
    
    setSelectedRating(rating);
    setIsAnimating(true);
    
    // Brief animation delay before calling onRate
    setTimeout(() => {
      onRate(rating);
      setSelectedRating(null);
      setIsAnimating(false);
    }, 300);
  };

  return (
    <div className="space-y-3">
      <p className="text-center text-slate-400 text-sm">How well did you know this?</p>
      <div className="flex justify-center gap-2">
        {RATING_CONFIG.map((config) => {
          const isSelected = selectedRating === config.value;
          
          return (
            <button
              key={config.value}
              onClick={() => handleRate(config.value)}
              disabled={disabled || isAnimating}
              className={`
                flex flex-col items-center justify-center
                w-16 h-20 rounded-xl
                border-2 transition-all duration-200
                ${isSelected 
                  ? "scale-110 shadow-lg" 
                  : "hover:scale-105 hover:shadow-md"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
              style={{
                backgroundColor: isSelected ? config.bgColor : "rgba(51, 65, 85, 0.5)",
                borderColor: isSelected ? config.color : "rgba(71, 85, 105, 0.5)",
                boxShadow: isSelected ? `0 0 20px ${config.bgColor}` : undefined,
              }}
            >
              <span className="text-2xl">{config.emoji}</span>
              <span 
                className="text-xs mt-1 font-medium"
                style={{ color: isSelected ? config.color : "#94a3b8" }}
              >
                {config.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Helper to get rating color
export function getRatingColor(rating: number | null): string {
  if (rating === null) return "#64748b";
  const config = RATING_CONFIG.find((r) => r.value === rating);
  return config?.color || "#64748b";
}

// Helper to get rating emoji
export function getRatingEmoji(rating: number | null): string {
  if (rating === null) return "➖";
  const config = RATING_CONFIG.find((r) => r.value === rating);
  return config?.emoji || "➖";
}

// Helper to format rating history
export function formatRatingHistory(ratings: number[]): string {
  if (ratings.length === 0) return "No ratings yet";
  if (ratings.length === 1) return `Rated: ${ratings[0]}`;
  return ratings.map(String).join(" → ");
}

