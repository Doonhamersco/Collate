"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Deck } from "@/app/dashboard/page";

interface DeckFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: DeckFormData) => Promise<void>;
  editingDeck?: Deck | null;
}

export interface DeckFormData {
  name: string;
  description: string | null;
  color: string;
}

const DECK_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899",
];

export function DeckFormModal({
  open,
  onClose,
  onSave,
  editingDeck,
}: DeckFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(DECK_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const isEditing = !!editingDeck;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      if (editingDeck) {
        setName(editingDeck.name);
        setDescription(editingDeck.description || "");
        setColor(editingDeck.color);
      } else {
        setName("");
        setDescription("");
        // Pick a random color for new decks
        setColor(DECK_COLORS[Math.floor(Math.random() * DECK_COLORS.length)]);
      }
      setErrors({});
    }
  }, [open, editingDeck]);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = "Deck name is required";
    } else if (trimmedName.length < 2) {
      newErrors.name = "Deck name must be at least 2 characters";
    } else if (trimmedName.length > 50) {
      newErrors.name = "Deck name must be less than 50 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
      onClose();
    } catch (error) {
      console.error("Failed to save deck:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEditing ? "Edit Deck" : "Create Custom Deck"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Deck Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Deck Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Vocabulary, Formulas, Exam Review"
              className={`bg-slate-900 border-slate-600 ${errors.name ? "border-red-500" : ""}`}
              maxLength={50}
            />
            {errors.name && (
              <p className="text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this deck for?"
              className="bg-slate-900 border-slate-600 min-h-[60px] resize-none"
              maxLength={200}
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Color</label>
            <div className="flex flex-wrap gap-2">
              {DECK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c
                      ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
            <p className="text-xs text-slate-400 mb-2">Preview:</p>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-white font-medium">📚 {name || "Deck Name"}</span>
            </div>
            {description && (
              <p className="text-sm text-slate-400 mt-1 ml-6">{description}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold"
          >
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Deck"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

