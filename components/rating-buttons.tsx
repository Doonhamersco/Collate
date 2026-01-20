"use client";

import { useState } from "react";

const RATING_CONFIG = [
  { value: 1, emoji: "😫", label: "Didn't know", color: "#E57373", bgColor: "rgba(229, 115, 115, 0.15)" },
  { value: 2, emoji: "😕", label: "Struggled", color: "#FFB74D", bgColor: "rgba(255, 183, 77, 0.15)" },
  { value: 3, emoji: "😐", label: "Okay", color: "#FFF176", bgColor: "rgba(255, 241, 118, 0.15)" },
  { value: 4, emoji: "😊", label: "Good", color: "#AED581", bgColor: "rgba(174, 213, 129, 0.15)" },
  { value: 5, emoji: "🎯", label: "Perfect", color: "#7CB342", bgColor: "rgba(124, 179, 66, 0.15)" },
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
    <div className="space-y-4">
      <p className="text-center text-[#8B7355] text-sm font-medium">How well did you know this?</p>
      <div className="flex justify-center gap-3">
        {RATING_CONFIG.map((config) => {
          const isSelected = selectedRating === config.value;
          
          return (
            <button
              key={config.value}
              onClick={() => handleRate(config.value)}
              disabled={disabled || isAnimating}
              className={`
                flex flex-col items-center justify-center
                w-[72px] h-24 rounded-2xl
                border-2 transition-all duration-200
                ${isSelected 
                  ? "scale-110 shadow-soft-lg" 
                  : "hover:scale-105 shadow-soft hover:shadow-soft-lg"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
              style={{
                backgroundColor: isSelected ? config.bgColor : "white",
                borderColor: isSelected ? config.color : "#EBE4D6",
                boxShadow: isSelected ? `0 8px 30px ${config.bgColor}` : undefined,
              }}
            >
              <span className="text-3xl">{config.emoji}</span>
              <span 
                className="text-xs mt-1.5 font-semibold"
                style={{ color: isSelected ? config.color : "#8B7355" }}
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
  if (rating === null) return "#8B7355";
  const config = RATING_CONFIG.find((r) => r.value === rating);
  return config?.color || "#8B7355";
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
