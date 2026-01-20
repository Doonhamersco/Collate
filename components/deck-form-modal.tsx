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
  "#E57373", "#FFB74D", "#FFF176", "#AED581", "#7CB342",
  "#4DB6AC", "#4FC3F7", "#64B5F6", "#7986CB", "#9575CD",
  "#BA68C8", "#F06292", "#FF8A65",
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
      <DialogContent className="bg-white border-0 rounded-3xl shadow-soft-lg text-[#2C1810] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">
            {isEditing ? "Edit Deck" : "Create Custom Deck"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Deck Name */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#4A3426]">Deck Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Vocabulary, Formulas, Exam Review"
              className={`h-12 rounded-xl bg-[#F5F1E8] border-0 focus:ring-2 focus:ring-[#7CB342]/30 ${errors.name ? "ring-2 ring-[#E57373]" : ""}`}
              maxLength={50}
            />
            {errors.name && (
              <p className="text-xs text-[#E57373] font-medium">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#4A3426]">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this deck for?"
              className="bg-[#F5F1E8] border-0 min-h-[60px] resize-none rounded-xl focus:ring-2 focus:ring-[#7CB342]/30"
              maxLength={200}
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[#4A3426]">Color</label>
            <div className="flex flex-wrap gap-2">
              {DECK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-xl transition-all ${
                    color === c
                      ? "ring-2 ring-[#4A3426] ring-offset-2 ring-offset-white scale-110"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-2xl bg-[#F5F1E8]">
            <p className="text-xs text-[#8B7355] mb-3 font-medium">Preview:</p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl shadow-soft flex items-center justify-center"
                style={{ backgroundColor: color }}
              >
                <span className="text-lg">📚</span>
              </div>
              <div>
                <span className="text-[#2C1810] font-semibold">{name || "Deck Name"}</span>
                {description && (
                  <p className="text-sm text-[#8B7355] mt-0.5">{description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border-[#D7CFC0] text-[#4A3426] hover:bg-[#F5F1E8]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-[#7CB342] hover:bg-[#689F38] text-white font-semibold shadow-soft"
          >
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Deck"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
