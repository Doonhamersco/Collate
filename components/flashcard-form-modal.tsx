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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Flashcard, FlashcardType, Course, Deck } from "@/app/dashboard/page";

interface FlashcardFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: FlashcardFormData) => Promise<void>;
  courses: Course[];
  decks: Deck[];
  editingFlashcard?: Flashcard | null;
  preSelectedCourseId?: string | null;
  preSelectedDeckId?: string | null;
}

export interface FlashcardFormData {
  type: FlashcardType;
  question: string;
  answer: string;
  courseId: string | null;
  deckId: string | null;
}

const FLASHCARD_TYPES: { value: FlashcardType; label: string; icon: string; description: string }[] = [
  { value: "qa", label: "Q&A", icon: "❓", description: "Question and answer" },
  { value: "definition", label: "Definition", icon: "📖", description: "Term and definition" },
  { value: "true_false", label: "True/False", icon: "✓✗", description: "Statement with T/F answer" },
  { value: "fill_blank", label: "Fill Blank", icon: "___", description: "Sentence with blank" },
];

export function FlashcardFormModal({
  open,
  onClose,
  onSave,
  courses,
  decks,
  editingFlashcard,
  preSelectedCourseId,
  preSelectedDeckId,
}: FlashcardFormModalProps) {
  const [type, setType] = useState<FlashcardType>("qa");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [destination, setDestination] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ question?: string; answer?: string; destination?: string }>({});

  const isEditing = !!editingFlashcard;

  // Reset form when modal opens/closes or editingFlashcard changes
  useEffect(() => {
    if (open) {
      if (editingFlashcard) {
        setType(editingFlashcard.type || "qa");
        setQuestion(editingFlashcard.question);
        setAnswer(editingFlashcard.answer);
        // Set destination based on what the card has
        if (editingFlashcard.deckId) {
          setDestination(`deck:${editingFlashcard.deckId}`);
        } else if (editingFlashcard.courseId) {
          setDestination(`course:${editingFlashcard.courseId}`);
        } else {
          setDestination("");
        }
      } else {
        setType("qa");
        setQuestion("");
        setAnswer("");
        // Pre-select destination if provided
        if (preSelectedDeckId) {
          setDestination(`deck:${preSelectedDeckId}`);
        } else if (preSelectedCourseId) {
          setDestination(`course:${preSelectedCourseId}`);
        } else {
          setDestination("");
        }
      }
      setErrors({});
    }
  }, [open, editingFlashcard, preSelectedCourseId, preSelectedDeckId]);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Question validation
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      newErrors.question = "Question is required";
    } else if (trimmedQuestion.length < 3) {
      newErrors.question = "Question must be at least 3 characters";
    } else if (trimmedQuestion.length > 500) {
      newErrors.question = "Question must be less than 500 characters";
    }

    // Answer validation
    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      newErrors.answer = "Answer is required";
    } else if (trimmedAnswer.length > 1000) {
      newErrors.answer = "Answer must be less than 1000 characters";
    }

    // Fill-in-blank validation
    if (type === "fill_blank" && !trimmedQuestion.includes("{{blank}}")) {
      newErrors.question = "Fill-in-blank must contain {{blank}} placeholder";
    }

    // True/False validation
    if (type === "true_false") {
      const lowerAnswer = trimmedAnswer.toLowerCase();
      if (lowerAnswer !== "true" && lowerAnswer !== "false") {
        newErrors.answer = "Answer must be 'True' or 'False'";
      }
    }

    // Destination validation
    if (!destination) {
      newErrors.destination = "Please select where to save this flashcard";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Parse destination
      let courseId: string | null = null;
      let deckId: string | null = null;

      if (destination.startsWith("course:")) {
        courseId = destination.replace("course:", "");
      } else if (destination.startsWith("deck:")) {
        deckId = destination.replace("deck:", "");
      }

      await onSave({
        type,
        question: question.trim(),
        answer: answer.trim(),
        courseId,
        deckId,
      });

      onClose();
    } catch (error) {
      console.error("Failed to save flashcard:", error);
    } finally {
      setSaving(false);
    }
  };

  // Get labels based on type
  const getQuestionLabel = () => {
    switch (type) {
      case "definition": return "Term";
      case "true_false": return "Statement";
      case "fill_blank": return "Sentence (use {{blank}} for the blank)";
      default: return "Question";
    }
  };

  const getAnswerLabel = () => {
    switch (type) {
      case "definition": return "Definition";
      case "true_false": return "Answer (True or False)";
      case "fill_blank": return "Answer (the word that fills the blank)";
      default: return "Answer";
    }
  };

  const getQuestionPlaceholder = () => {
    switch (type) {
      case "definition": return "e.g., Photosynthesis";
      case "true_false": return "e.g., The Earth is flat.";
      case "fill_blank": return "e.g., The {{blank}} is the powerhouse of the cell.";
      default: return "Enter your question...";
    }
  };

  const getAnswerPlaceholder = () => {
    switch (type) {
      case "definition": return "e.g., The process by which plants convert sunlight into energy...";
      case "true_false": return "True or False";
      case "fill_blank": return "e.g., mitochondria";
      default: return "Enter the answer...";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-white border-0 rounded-3xl shadow-soft-lg text-[#2C1810] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-serif">
            {isEditing ? "Edit Flashcard" : "Create Flashcard"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* AI card notice */}
          {isEditing && editingFlashcard?.source === "ai_generated" && (
            <div className="p-4 rounded-2xl bg-[#E3F2FD] text-sm">
              <p className="text-[#1976D2]">
                ℹ️ This card was AI-generated
                {editingFlashcard.fileName && ` from "${editingFlashcard.fileName}"`}.
                {!editingFlashcard.isEdited && " Original will be preserved if you make changes."}
              </p>
            </div>
          )}

          {/* Card Type Selector */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-[#4A3426]">Card Type</label>
            <div className="grid grid-cols-4 gap-2">
              {FLASHCARD_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`p-3 rounded-2xl border-2 text-center transition-all ${
                    type === t.value
                      ? "border-[#7CB342] bg-[#7CB342]/10"
                      : "border-[#EBE4D6] hover:border-[#D7CFC0] hover:bg-[#F5F1E8]"
                  }`}
                >
                  <div className="text-xl mb-1">{t.icon}</div>
                  <div className="text-xs font-semibold text-[#4A3426]">{t.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Destination Selector */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#4A3426]">Save to *</label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger className={`h-12 rounded-xl bg-[#F5F1E8] border-0 ${errors.destination ? "ring-2 ring-[#E57373]" : ""}`}>
                <SelectValue placeholder="Select course or deck..." />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#EBE4D6] rounded-xl shadow-soft">
                {courses.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs text-[#8B7355] font-semibold uppercase tracking-wide">Courses</div>
                    {courses.map((course) => (
                      <SelectItem key={`course:${course.id}`} value={`course:${course.id}`} className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: course.color }}
                          />
                          {course.name}
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
                {decks.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs text-[#8B7355] font-semibold uppercase tracking-wide mt-1">Custom Decks</div>
                    {decks.map((deck) => (
                      <SelectItem key={`deck:${deck.id}`} value={`deck:${deck.id}`} className="rounded-lg">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: deck.color }}
                          />
                          📚 {deck.name}
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            {errors.destination && (
              <p className="text-xs text-[#E57373] font-medium">{errors.destination}</p>
            )}
          </div>

          {/* Question/Term Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[#4A3426]">{getQuestionLabel()} *</label>
              <span className="text-xs text-[#8B7355]">{question.length}/500</span>
            </div>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={getQuestionPlaceholder()}
              className={`bg-[#F5F1E8] border-0 min-h-[80px] resize-none rounded-xl focus:ring-2 focus:ring-[#7CB342]/30 ${errors.question ? "ring-2 ring-[#E57373]" : ""}`}
              maxLength={500}
            />
            {errors.question && (
              <p className="text-xs text-[#E57373] font-medium">{errors.question}</p>
            )}
          </div>

          {/* Answer Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-[#4A3426]">{getAnswerLabel()} *</label>
              <span className="text-xs text-[#8B7355]">{answer.length}/1000</span>
            </div>
            {type === "true_false" ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setAnswer("True")}
                  className={`flex-1 py-4 rounded-xl border-2 font-semibold transition-all ${
                    answer.toLowerCase() === "true"
                      ? "border-[#7CB342] bg-[#7CB342]/10 text-[#689F38]"
                      : "border-[#EBE4D6] text-[#4A3426] hover:border-[#D7CFC0]"
                  }`}
                >
                  ✓ True
                </button>
                <button
                  onClick={() => setAnswer("False")}
                  className={`flex-1 py-4 rounded-xl border-2 font-semibold transition-all ${
                    answer.toLowerCase() === "false"
                      ? "border-[#E57373] bg-[#E57373]/10 text-[#E57373]"
                      : "border-[#EBE4D6] text-[#4A3426] hover:border-[#D7CFC0]"
                  }`}
                >
                  ✗ False
                </button>
              </div>
            ) : (
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={getAnswerPlaceholder()}
                className={`bg-[#F5F1E8] border-0 min-h-[80px] resize-none rounded-xl focus:ring-2 focus:ring-[#7CB342]/30 ${errors.answer ? "ring-2 ring-[#E57373]" : ""}`}
                maxLength={1000}
              />
            )}
            {errors.answer && (
              <p className="text-xs text-[#E57373] font-medium">{errors.answer}</p>
            )}
          </div>

          {/* Fill-in-blank preview */}
          {type === "fill_blank" && question.includes("{{blank}}") && (
            <div className="p-4 rounded-2xl bg-[#F5F1E8]">
              <p className="text-xs text-[#8B7355] mb-2 font-medium">Preview:</p>
              <p className="text-[#2C1810] font-medium">
                {question.replace("{{blank}}", "_____")}
              </p>
              {answer && (
                <p className="text-[#7CB342] text-sm mt-2">
                  Answer: {answer}
                </p>
              )}
            </div>
          )}

          {/* Last edited timestamp */}
          {isEditing && editingFlashcard?.updatedAt && (
            <p className="text-xs text-[#8B7355]">
              Last edited: {new Date(editingFlashcard.updatedAt).toLocaleString()}
            </p>
          )}
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
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Flashcard"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
