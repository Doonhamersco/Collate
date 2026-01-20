"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, writeBatch, serverTimestamp, updateDoc, setDoc, addDoc, Timestamp, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileUpload } from "@/components/file-upload";
import { FileList } from "@/components/file-list";
import { FlashcardViewer } from "@/components/flashcard-viewer";
import { PreStudyModal, type StudyMode, type CardLimit } from "@/components/pre-study-modal";
import { FlashcardFormModal, type FlashcardFormData } from "@/components/flashcard-form-modal";
import { DeckFormModal, type DeckFormData } from "@/components/deck-form-modal";
import { DeleteConfirmModal } from "@/components/delete-confirm-modal";
import { DeleteCourseModal } from "@/components/delete-course-modal";
import { 
  deleteCourseWithCascade, 
  deleteFileWithCascade,
  deleteDeckWithCascade, 
  restoreDeletedData
} from "@/lib/cascading-delete";

export interface Course {
  id: string;
  name: string;
  color: string;
  emoji: string;
  createdAt: Date;
}

// Popular emojis for course selection
const COURSE_EMOJIS = [
  "📚", "📖", "📝", "✏️", "🎓", "💡", "🧠", "🔬", "🧪", "🔭",
  "📐", "📊", "💻", "🖥️", "🌐", "🎨", "🎭", "🎵", "🏛️", "⚖️",
  "💼", "📈", "🏥", "💊", "🌿", "🌍", "🗺️", "📷", "✈️", "🚀",
  "⚽", "🏀", "🎯", "♟️", "🧩", "🔧", "⚡", "🔥", "❤️", "⭐",
];

export interface FileDocument {
  id: string;
  name: string;
  size: number;
  fileType: string;
  storagePath: string;
  downloadUrl: string;
  extractedText: string;
  status: "uploading" | "processing" | "ready" | "failed";
  courseId: string | null;
  uploadedAt: Date;
}

export type FlashcardType = "qa" | "definition" | "true_false" | "fill_blank";
export type FlashcardSource = "ai_generated" | "manual";

export interface Flashcard {
  id: string;
  
  // Organization
  fileId: string | null;        // null for manual cards
  fileName: string | null;      // null for manual cards
  courseId: string | null;
  courseName: string | null;
  deckId: string | null;        // For custom decks
  
  // Content
  type: FlashcardType;
  question: string;
  answer: string;
  
  // Source tracking
  source: FlashcardSource;
  isEdited: boolean;
  originalQuestion: string | null;
  originalAnswer: string | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date | null;
  
  // Rating fields
  latestRating: number | null;
  ratingCount: number;
  consecutiveFives: number;
  averageRating: number | null;
  mastered: boolean;
  masteredAt: Date | null;
  nextReviewAt: Date | null;
}

export interface Deck {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface RatingRecord {
  id: string;
  flashcardId: string;
  fileId: string | null;
  courseId: string | null;
  deckId: string | null;
  rating: number;
  timestamp: Date;
  sessionId: string;
  timeSpentMs: number;
}

interface StudySessionConfig {
  mode: StudyMode;
  limit: CardLimit;
  sourceType: "all" | "course" | "file" | "deck";
  sourceId: string | null;
}

// Pastel gradient palette for courses/decks
const GRADIENT_CLASSES = [
  "gradient-yellow",
  "gradient-green",
  "gradient-peach",
  "gradient-lavender",
  "gradient-sky",
  "gradient-mint",
  "gradient-rose",
  "gradient-beige",
];

// Helper to calculate mastery percentage from flashcards
function calculateMastery(cards: Flashcard[]): { percentage: number; color: string } {
  if (cards.length === 0) return { percentage: 0, color: "#8B7355" };
  
  const studiedCards = cards.filter((c) => c.ratingCount > 0);
  if (studiedCards.length === 0) return { percentage: 0, color: "#8B7355" };
  
  const avgRating = studiedCards.reduce((sum, c) => sum + (c.averageRating || 0), 0) / studiedCards.length;
  const percentage = Math.round(((avgRating - 1) / 4) * 100);
  
  // Color based on mastery
  if (percentage >= 80) return { percentage, color: "#7CB342" }; // Green
  if (percentage >= 60) return { percentage, color: "#FFB74D" }; // Amber
  return { percentage, color: "#E57373" }; // Red
}

// Shuffle array using Fisher-Yates
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [files, setFiles] = useState<FileDocument[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [viewingFlashcards, setViewingFlashcards] = useState(false);
  const [studySessionId, setStudySessionId] = useState<string | null>(null);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseEmoji, setNewCourseEmoji] = useState("📚");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseEmoji, setEditCourseEmoji] = useState("");
  const [showEditEmojiPicker, setShowEditEmojiPicker] = useState(false);
  
  // Pre-study modal state
  const [showPreStudyModal, setShowPreStudyModal] = useState(false);
  const [studySessionConfig, setStudySessionConfig] = useState<StudySessionConfig | null>(null);
  const [studyFlashcards, setStudyFlashcards] = useState<Flashcard[]>([]);
  
  // Flashcard form modal state
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);
  const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | null>(null);
  const [preSelectedCourseForCard, setPreSelectedCourseForCard] = useState<string | null>(null);
  const [preSelectedDeckForCard, setPreSelectedDeckForCard] = useState<string | null>(null);
  
  // Deck form modal state
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  
  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<{ type: "flashcard" | "deck"; id: string; preview: string } | null>(null);
  
  // Delete course modal state
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Subscribe to courses collection
  useEffect(() => {
    if (!user) return;

    const coursesRef = collection(db, "users", user.uid, "courses");
    const q = query(coursesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const coursesData: Course[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        coursesData.push({
          id: doc.id,
          name: data.name,
          color: data.color,
          emoji: data.emoji || "📚",
          createdAt: data.createdAt?.toDate() || new Date(),
        });
      });
      setCourses(coursesData);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to files collection
  useEffect(() => {
    if (!user) return;

    const filesRef = collection(db, "users", user.uid, "files");
    const q = query(filesRef, orderBy("uploadedAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const filesData: FileDocument[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        filesData.push({
          id: doc.id,
          name: data.name,
          size: data.size,
          fileType: data.fileType || "pdf",
          storagePath: data.storagePath,
          downloadUrl: data.downloadUrl,
          extractedText: data.extractedText || "",
          status: data.status,
          courseId: data.courseId || null,
          uploadedAt: data.uploadedAt?.toDate() || new Date(),
        });
      });
      setFiles(filesData);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to decks collection
  useEffect(() => {
    if (!user) return;

    const decksRef = collection(db, "users", user.uid, "decks");
    const q = query(decksRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const decksData: Deck[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        decksData.push({
          id: doc.id,
          name: data.name,
          description: data.description || null,
          color: data.color,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || null,
        });
      });
      setDecks(decksData);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to flashcards collection
  useEffect(() => {
    if (!user) return;

    const flashcardsRef = collection(db, "users", user.uid, "flashcards");
    const q = query(flashcardsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const flashcardsData: Flashcard[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        flashcardsData.push({
          id: doc.id,
          // Organization
          fileId: data.fileId || null,
          fileName: data.fileName || null,
          courseId: data.courseId || null,
          courseName: data.courseName || null,
          deckId: data.deckId || null,
          // Content
          type: data.type || "qa",
          question: data.question,
          answer: data.answer,
          // Source tracking
          source: data.source || "ai_generated",
          isEdited: data.isEdited ?? false,
          originalQuestion: data.originalQuestion || null,
          originalAnswer: data.originalAnswer || null,
          // Timestamps
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || null,
          // Rating fields
          latestRating: data.latestRating ?? null,
          ratingCount: data.ratingCount ?? 0,
          consecutiveFives: data.consecutiveFives ?? 0,
          averageRating: data.averageRating ?? null,
          mastered: data.mastered ?? false,
          masteredAt: data.masteredAt?.toDate() || null,
          nextReviewAt: data.nextReviewAt?.toDate() || null,
        });
      });
      setFlashcards(flashcardsData);
    });

    return () => unsubscribe();
  }, [user]);

  // Calculate course and deck stats
  const courseStats = useMemo(() => {
    const stats: Record<string, { total: number; mastered: number; mastery: ReturnType<typeof calculateMastery> }> = {};
    
    courses.forEach((course) => {
      const courseCards = flashcards.filter((f) => f.courseId === course.id);
      stats[course.id] = {
        total: courseCards.length,
        mastered: courseCards.filter((c) => c.mastered).length,
        mastery: calculateMastery(courseCards),
      };
    });
    
    // Deck stats
    decks.forEach((deck) => {
      const deckCards = flashcards.filter((f) => f.deckId === deck.id);
      stats[`deck:${deck.id}`] = {
        total: deckCards.length,
        mastered: deckCards.filter((c) => c.mastered).length,
        mastery: calculateMastery(deckCards),
      };
    });
    
    // All files stats (including deck cards)
    stats["all"] = {
      total: flashcards.length,
      mastered: flashcards.filter((c) => c.mastered).length,
      mastery: calculateMastery(flashcards),
    };
    
    return stats;
  }, [courses, decks, flashcards]);

  const handleCreateCourse = async () => {
    if (!user || !newCourseName.trim()) return;

    try {
      const courseId = `course_${Date.now()}`;
      const gradientClass = GRADIENT_CLASSES[courses.length % GRADIENT_CLASSES.length];

      await setDoc(doc(db, "users", user.uid, "courses", courseId), {
        name: newCourseName.trim(),
        color: gradientClass,
        emoji: newCourseEmoji,
        createdAt: serverTimestamp(),
      });

      setNewCourseName("");
      setNewCourseEmoji("📚");
      setShowNewCourse(false);
      setShowEmojiPicker(false);
      toast.success("Course created!");
    } catch (error) {
      toast.error("Failed to create course");
    }
  };

  const handleRenameCourse = async (courseId: string) => {
    if (!user || !editCourseName.trim()) return;

    try {
      await updateDoc(doc(db, "users", user.uid, "courses", courseId), {
        name: editCourseName.trim(),
        emoji: editCourseEmoji,
      });
      setEditingCourseId(null);
      setEditCourseName("");
      setEditCourseEmoji("");
      setShowEditEmojiPicker(false);
      toast.success("Course updated!");
    } catch (error) {
      toast.error("Failed to update course");
    }
  };

  // Open delete course confirmation modal
  const handleDeleteCourseClick = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    if (course) {
      setDeletingCourse(course);
    }
  };

  // Confirm and execute course deletion with cascading
  const handleConfirmDeleteCourse = async () => {
    if (!user || !deletingCourse) return;

    try {
      await deleteCourseWithCascade(
        user.uid,
        deletingCourse.id,
        deletingCourse,
        files,
        flashcards
      );
      
      if (selectedCourseId === deletingCourse.id) {
        setSelectedCourseId(null);
      }
      
      setDeletingCourse(null);
      
      // Show undo toast
      toast.success("Course deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            const restored = await restoreDeletedData(user.uid);
            if (restored) {
              toast.success("Course restored!");
            } else {
              toast.error("Could not restore - undo window expired");
            }
          },
        },
        duration: 10000, // 10 seconds
      });
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete course");
      setDeletingCourse(null);
    }
  };

  // ============ FLASHCARD CRUD HANDLERS ============

  const openFlashcardModal = (courseId?: string | null, deckId?: string | null, flashcard?: Flashcard | null) => {
    setEditingFlashcard(flashcard || null);
    setPreSelectedCourseForCard(courseId || null);
    setPreSelectedDeckForCard(deckId || null);
    setShowFlashcardModal(true);
  };

  const handleSaveFlashcard = async (data: FlashcardFormData) => {
    if (!user) return;

    const courseName = data.courseId 
      ? courses.find(c => c.id === data.courseId)?.name || null 
      : null;

    if (editingFlashcard) {
      // Editing existing flashcard
      const isAiCard = editingFlashcard.source === "ai_generated";
      const contentChanged = 
        editingFlashcard.question !== data.question || 
        editingFlashcard.answer !== data.answer;

      const updateData: Record<string, unknown> = {
        type: data.type,
        question: data.question,
        answer: data.answer,
        courseId: data.courseId,
        courseName,
        deckId: data.deckId,
        updatedAt: serverTimestamp(),
      };

      // If AI card is being edited for the first time, preserve original
      if (isAiCard && contentChanged && !editingFlashcard.isEdited) {
        updateData.isEdited = true;
        updateData.originalQuestion = editingFlashcard.question;
        updateData.originalAnswer = editingFlashcard.answer;
      } else if (isAiCard && contentChanged) {
        updateData.isEdited = true;
      }

      await updateDoc(doc(db, "users", user.uid, "flashcards", editingFlashcard.id), updateData);
      toast.success("Flashcard updated!");
    } else {
      // Creating new flashcard
      await addDoc(collection(db, "users", user.uid, "flashcards"), {
        type: data.type,
        question: data.question,
        answer: data.answer,
        courseId: data.courseId,
        courseName,
        deckId: data.deckId,
        fileId: null,
        fileName: null,
        source: "manual",
        isEdited: false,
        originalQuestion: null,
        originalAnswer: null,
        createdAt: serverTimestamp(),
        updatedAt: null,
        // Initialize rating fields
        latestRating: null,
        ratingCount: 0,
        consecutiveFives: 0,
        averageRating: null,
        mastered: false,
        masteredAt: null,
        nextReviewAt: null,
      });
      toast.success("Flashcard created!");
    }
  };

  const handleDeleteFlashcard = async (flashcardId: string) => {
    if (!user) return;

    // Delete the flashcard
    await deleteDoc(doc(db, "users", user.uid, "flashcards", flashcardId));
    
    // Delete associated ratings
    const ratingsRef = collection(db, "users", user.uid, "ratings");
    const ratingsQuery = query(ratingsRef, where("flashcardId", "==", flashcardId));
    const ratingsSnapshot = await getDocs(ratingsQuery);
    
    const batch = writeBatch(db);
    ratingsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    toast.success("Flashcard deleted!");
  };

  // ============ DECK CRUD HANDLERS ============

  const openDeckModal = (deck?: Deck | null) => {
    setEditingDeck(deck || null);
    setShowDeckModal(true);
  };

  const handleSaveDeck = async (data: DeckFormData) => {
    if (!user) return;

    if (editingDeck) {
      // Editing existing deck
      await updateDoc(doc(db, "users", user.uid, "decks", editingDeck.id), {
        name: data.name,
        description: data.description,
        color: data.color,
        updatedAt: serverTimestamp(),
      });
      toast.success("Deck updated!");
    } else {
      // Creating new deck
      await addDoc(collection(db, "users", user.uid, "decks"), {
        name: data.name,
        description: data.description,
        color: data.color,
        createdAt: serverTimestamp(),
        updatedAt: null,
      });
      toast.success("Deck created!");
    }
  };

  const handleDeleteDeck = async (deckId: string) => {
    if (!user) return;

    const deck = decks.find(d => d.id === deckId);
    if (!deck) return;

    try {
      await deleteDeckWithCascade(user.uid, deckId, deck, flashcards);
      
      if (selectedDeckId === deckId) {
        setSelectedDeckId(null);
      }
      
      // Show undo toast
      toast.success("Deck deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            const restored = await restoreDeletedData(user.uid);
            if (restored) {
              toast.success("Deck restored!");
            } else {
              toast.error("Could not restore - undo window expired");
            }
          },
        },
        duration: 10000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete deck";
      toast.error(message);
    }
  };

  // ============ DELETE CONFIRMATION HANDLER ============

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "flashcard") {
      await handleDeleteFlashcard(deleteTarget.id);
    } else if (deleteTarget.type === "deck") {
      await handleDeleteDeck(deleteTarget.id);
    }
  };

  const handleGenerateFlashcards = async (fileId: string) => {
    if (!user) return;

    const file = files.find((f) => f.id === fileId);
    if (!file || file.status !== "ready") {
      toast.error("File is not ready for flashcard generation");
      return;
    }

    if (!file.extractedText || file.extractedText.trim().length === 0) {
      toast.error("No text extracted from this file");
      return;
    }

    setGenerating(fileId);

    // Get course info for the file
    const course = file.courseId ? courses.find((c) => c.id === file.courseId) : null;

    try {
      const response = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          fileId: file.id,
          fileName: file.name,
          courseId: file.courseId,
          courseName: course?.name || null,
          text: file.extractedText,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate flashcards");
      }

      const result = await response.json();

      // Save flashcards to Firestore
      const batchWrite = writeBatch(db);

      for (const flashcard of result.flashcards) {
        const flashcardRef = doc(collection(db, "users", user.uid, "flashcards"));
        batchWrite.set(flashcardRef, {
          ...flashcard,
          createdAt: serverTimestamp(),
        });
      }

      await batchWrite.commit();

      toast.success(`Generated ${result.count} flashcards!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred";
      toast.error(message);
    } finally {
      setGenerating(null);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!user) return;

    const file = files.find((f) => f.id === fileId);
    if (!file) return;

    try {
      await deleteFileWithCascade(user.uid, fileId, file, flashcards);
      
      // Show undo toast
      toast.success("File deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            const restored = await restoreDeletedData(user.uid);
            if (restored) {
              toast.success("File restored!");
            } else {
              toast.error("Could not restore - undo window expired");
            }
          },
        },
        duration: 10000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete file";
      toast.error(message);
    }
  };

  const handleRenameFile = async (fileId: string, newName: string) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, "users", user.uid, "files", fileId), {
        name: newName,
      });
      toast.success("File renamed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rename file";
      toast.error(message);
    }
  };

  // Spaced repetition intervals (in days)
  const REVIEW_INTERVALS: Record<number, number> = {
    1: 1,    // Rating 1: Review in 1 day
    2: 1,    // Rating 2: Review in 1 day  
    3: 3,    // Rating 3: Review in 3 days
    4: 7,    // Rating 4: Review in 7 days
    5: 30,   // Rating 5: Review in 30 days
  };

  const handleRateFlashcard = async (cardId: string, rating: number, timeSpentMs: number) => {
    if (!user) return;

    const flashcard = flashcards.find((f) => f.id === cardId);
    if (!flashcard) return;

    // Calculate new consecutive fives
    let consecutiveFives = rating === 5 
      ? (flashcard.consecutiveFives || 0) + 1 
      : 0;

    // Check for auto-mastery (3 consecutive 5s)
    const mastered = consecutiveFives >= 3;

    // Calculate new average
    const totalRatings = (flashcard.ratingCount || 0) + 1;
    const currentSum = (flashcard.averageRating || 0) * (flashcard.ratingCount || 0);
    const newAverage = (currentSum + rating) / totalRatings;

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + REVIEW_INTERVALS[rating]);

    try {
      // Update flashcard document
      await updateDoc(doc(db, "users", user.uid, "flashcards", cardId), {
        latestRating: rating,
        ratingCount: totalRatings,
        consecutiveFives,
        averageRating: newAverage,
        mastered,
        masteredAt: mastered ? serverTimestamp() : flashcard.masteredAt,
        nextReviewAt: Timestamp.fromDate(nextReview),
      });

      // Store rating in history
      await addDoc(collection(db, "users", user.uid, "ratings"), {
        flashcardId: cardId,
        fileId: flashcard.fileId,
        courseId: flashcard.courseId,
        rating,
        timestamp: serverTimestamp(),
        sessionId: studySessionId || `session_${Date.now()}`,
        timeSpentMs,
      });

      // Show mastery notification
      if (mastered && !flashcard.mastered) {
        toast.success("🏆 Card mastered! Rated 5 three times in a row!");
      }
    } catch (error) {
      console.error("Failed to save rating:", error);
      toast.error("Failed to save rating");
      throw error;
    }
  };

  // Prepare flashcards for study based on mode
  const prepareStudyFlashcards = (
    cards: Flashcard[],
    mode: StudyMode,
    limit: CardLimit
  ): Flashcard[] => {
    // Filter out mastered cards
    let studyCards = cards.filter((c) => !c.mastered);
    
    if (mode === "smart") {
      // Smart mode: Prioritize weak cards and due for review
      const now = new Date();
      
      // Categorize cards
      const dueForReview = studyCards.filter((c) => c.nextReviewAt && new Date(c.nextReviewAt) <= now);
      const weakCards = studyCards.filter((c) => c.latestRating !== null && c.latestRating <= 2);
      const neverStudied = studyCards.filter((c) => c.latestRating === null);
      const otherCards = studyCards.filter(
        (c) => 
          !dueForReview.includes(c) && 
          !weakCards.includes(c) && 
          !neverStudied.includes(c)
      );
      
      // Build prioritized queue: due for review → weak → never studied → others
      // Each category is shuffled internally
      studyCards = [
        ...shuffleArray(dueForReview),
        ...shuffleArray(weakCards.filter((c) => !dueForReview.includes(c))),
        ...shuffleArray(neverStudied),
        ...shuffleArray(otherCards),
      ];
    } else {
      // Study All mode: Random shuffle
      studyCards = shuffleArray(studyCards);
    }
    
    // Apply limit
    if (limit !== "all" && studyCards.length > limit) {
      studyCards = studyCards.slice(0, limit);
    }
    
    return studyCards;
  };

  // Open pre-study modal for different sources
  const openStudyModal = (sourceType: "all" | "course" | "file" | "deck", sourceId: string | null) => {
    setStudySessionConfig({
      mode: "smart",
      limit: "all",
      sourceType,
      sourceId,
    });
    setShowPreStudyModal(true);
  };

  // Start study session
  const startStudySession = (mode: StudyMode, limit: CardLimit) => {
    if (!studySessionConfig) return;
    
    let sourceCards: Flashcard[];
    
    if (studySessionConfig.sourceType === "file" && studySessionConfig.sourceId) {
      sourceCards = flashcards.filter((f) => f.fileId === studySessionConfig.sourceId);
    } else if (studySessionConfig.sourceType === "course" && studySessionConfig.sourceId) {
      sourceCards = flashcards.filter((f) => f.courseId === studySessionConfig.sourceId);
    } else if (studySessionConfig.sourceType === "deck" && studySessionConfig.sourceId) {
      sourceCards = flashcards.filter((f) => f.deckId === studySessionConfig.sourceId);
    } else {
      // All files
      sourceCards = selectedCourseId 
        ? flashcards.filter((f) => f.courseId === selectedCourseId)
        : selectedDeckId
          ? flashcards.filter((f) => f.deckId === selectedDeckId)
          : flashcards;
    }
    
    const preparedCards = prepareStudyFlashcards(sourceCards, mode, limit);
    
    if (preparedCards.length === 0) {
      toast.info("No cards available to study. All cards may be mastered!");
      setShowPreStudyModal(false);
      return;
    }
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    setStudySessionId(sessionId);
    setStudyFlashcards(preparedCards);
    setShowPreStudyModal(false);
    setViewingFlashcards(true);
  };

  // Get flashcards for modal display
  const getModalFlashcards = (): Flashcard[] => {
    if (!studySessionConfig) return [];
    
    if (studySessionConfig.sourceType === "file" && studySessionConfig.sourceId) {
      return flashcards.filter((f) => f.fileId === studySessionConfig.sourceId);
    } else if (studySessionConfig.sourceType === "course" && studySessionConfig.sourceId) {
      return flashcards.filter((f) => f.courseId === studySessionConfig.sourceId);
    } else if (studySessionConfig.sourceType === "deck" && studySessionConfig.sourceId) {
      return flashcards.filter((f) => f.deckId === studySessionConfig.sourceId);
    } else {
      return selectedCourseId 
        ? flashcards.filter((f) => f.courseId === selectedCourseId)
        : selectedDeckId
          ? flashcards.filter((f) => f.deckId === selectedDeckId)
          : flashcards;
    }
  };

  // Get modal title
  const getModalTitle = (): string => {
    if (!studySessionConfig) return "Study Flashcards";
    
    if (studySessionConfig.sourceType === "file" && studySessionConfig.sourceId) {
      const file = files.find((f) => f.id === studySessionConfig.sourceId);
      return `Study: ${file?.name || "File"}`;
    } else if (studySessionConfig.sourceType === "course" && studySessionConfig.sourceId) {
      const course = courses.find((c) => c.id === studySessionConfig.sourceId);
      return `Study: ${course?.name || "Course"}`;
    } else if (studySessionConfig.sourceType === "deck" && studySessionConfig.sourceId) {
      const deck = decks.find((d) => d.id === studySessionConfig.sourceId);
      return `Study: ${deck?.name || "Deck"}`;
    } else {
      return selectedCourseId 
        ? `Study: ${courses.find((c) => c.id === selectedCourseId)?.name || "Course"}`
        : selectedDeckId
          ? `Study: ${decks.find((d) => d.id === selectedDeckId)?.name || "Deck"}`
          : "Study All Flashcards";
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F1E8]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-beige flex items-center justify-center shadow-soft animate-pulse">
            <svg className="w-8 h-8 text-[#4A3426]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-[#8B7355] font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Filter files by selected course
  const filteredFiles = selectedCourseId
    ? files.filter((f) => f.courseId === selectedCourseId)
    : files;

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="min-h-screen bg-[#F5F1E8]">
      {/* Pre-study modal */}
      <PreStudyModal
        open={showPreStudyModal}
        onClose={() => setShowPreStudyModal(false)}
        onStart={startStudySession}
        title={getModalTitle()}
        flashcards={getModalFlashcards()}
      />

      {/* Flashcard form modal */}
      <FlashcardFormModal
        open={showFlashcardModal}
        onClose={() => {
          setShowFlashcardModal(false);
          setEditingFlashcard(null);
          setPreSelectedCourseForCard(null);
          setPreSelectedDeckForCard(null);
        }}
        onSave={handleSaveFlashcard}
        courses={courses}
        decks={decks}
        editingFlashcard={editingFlashcard}
        preSelectedCourseId={preSelectedCourseForCard}
        preSelectedDeckId={preSelectedDeckForCard}
      />

      {/* Deck form modal */}
      <DeckFormModal
        open={showDeckModal}
        onClose={() => {
          setShowDeckModal(false);
          setEditingDeck(null);
        }}
        onSave={handleSaveDeck}
        editingDeck={editingDeck}
      />

      {/* Delete confirm modal */}
      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={deleteTarget?.type === "flashcard" ? "Delete Flashcard?" : "Delete Deck?"}
        description={
          deleteTarget?.type === "flashcard"
            ? "Are you sure you want to delete this flashcard? Your study progress for this card will also be deleted."
            : "Are you sure you want to delete this deck?"
        }
        itemPreview={deleteTarget?.preview}
      />

      {/* Delete course modal */}
      <DeleteCourseModal
        open={!!deletingCourse}
        onClose={() => setDeletingCourse(null)}
        onConfirm={handleConfirmDeleteCourse}
        course={deletingCourse}
        files={files}
        flashcards={flashcards}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#D7CFC0]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl gradient-beige flex items-center justify-center shadow-soft">
              <svg className="w-6 h-6 text-[#4A3426]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#2C1810] font-serif">Collate</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              onClick={() => openFlashcardModal(selectedCourseId, selectedDeckId)}
              className="rounded-full px-5 bg-[#7CB342] hover:bg-[#689F38] text-white font-semibold shadow-soft transition-all hover:shadow-soft-lg hover:-translate-y-0.5"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Card
            </Button>
            <span className="text-sm text-[#8B7355]">{user.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="rounded-full border-[#D7CFC0] text-[#4A3426] hover:bg-[#EBE4D6] hover:border-[#C4B8A5]"
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {viewingFlashcards ? (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setViewingFlashcards(false);
                  setSelectedFileId(null);
                  setStudyFlashcards([]);
                  setStudySessionId(null);
                }}
                className="text-[#8B7355] hover:text-[#4A3426] hover:bg-[#EBE4D6] rounded-full"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to files
              </Button>
            </div>
            <FlashcardViewer
              flashcards={studyFlashcards}
              showSource={studyFlashcards.length > 0 && new Set(studyFlashcards.map(f => f.fileId)).size > 1}
              onRate={handleRateFlashcard}
              onClose={() => {
                setViewingFlashcards(false);
                setSelectedFileId(null);
                setStudyFlashcards([]);
                setStudySessionId(null);
              }}
              onEditFlashcard={(flashcard) => {
                openFlashcardModal(flashcard.courseId, flashcard.deckId, flashcard);
              }}
              onDeleteFlashcard={(flashcardId, preview) => {
                setDeleteTarget({ type: "flashcard", id: flashcardId, preview });
              }}
            />
          </div>
        ) : (
          <div className="flex gap-8 animate-fade-in">
            {/* Courses sidebar */}
            <div className="w-72 flex-shrink-0 space-y-6">
              <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-br from-[#FFF8E1] to-[#FFECB3]">
                  <CardTitle className="text-[#2C1810] text-lg font-serif flex items-center justify-between">
                    Courses
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowNewCourse(true)}
                      className="h-8 w-8 p-0 rounded-full text-[#8B7355] hover:text-[#4A3426] hover:bg-white/50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 p-3">
                  {/* All Files option */}
                  <div className="group">
                    <button
                      onClick={() => {
                        setSelectedCourseId(null);
                        setSelectedDeckId(null);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center gap-3 ${
                        selectedCourseId === null && selectedDeckId === null
                          ? "bg-[#7CB342]/10 text-[#689F38] shadow-sm"
                          : "text-[#4A3426] hover:bg-[#F5F1E8]"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        selectedCourseId === null && selectedDeckId === null
                          ? "bg-[#7CB342]/20"
                          : "bg-[#EBE4D6]"
                      }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium block">All Files</span>
                        <span className="text-xs text-[#8B7355]">{files.length} files</span>
                      </div>
                    </button>
                    {/* Study button for All Files */}
                    {courseStats["all"]?.total > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 ml-12">
                        <div className="flex-1 flex items-center gap-2">
                          {courseStats["all"].mastery.percentage > 0 && (
                            <span className="text-xs font-semibold" style={{ color: courseStats["all"].mastery.color }}>
                              {courseStats["all"].mastery.percentage}%
                            </span>
                          )}
                          <span className="text-xs text-[#8B7355]">{courseStats["all"].total} cards</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudyModal("all", null);
                          }}
                          className="text-xs px-3 py-1.5 rounded-full bg-[#7CB342]/10 text-[#689F38] hover:bg-[#7CB342]/20 transition-colors font-medium"
                        >
                          Study
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="my-3 border-t border-[#EBE4D6]" />

                  {/* Course list */}
                  {courses.map((course, index) => {
                    const courseFileCount = files.filter((f) => f.courseId === course.id).length;
                    const stats = courseStats[course.id];
                    const isEditing = editingCourseId === course.id;
                    const gradientClass = GRADIENT_CLASSES[index % GRADIENT_CLASSES.length];

                    return (
                      <div key={course.id} className="group">
                        {isEditing ? (
                          <div className="px-3 py-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <button
                                  onClick={() => setShowEditEmojiPicker(!showEditEmojiPicker)}
                                  className={`w-10 h-10 rounded-xl ${gradientClass} flex items-center justify-center text-xl hover:scale-105 transition-transform`}
                                >
                                  {editCourseEmoji}
                                </button>
                                {showEditEmojiPicker && (
                                  <div className="absolute top-12 left-0 z-50 p-3 bg-white rounded-2xl shadow-soft-lg border border-[#EBE4D6] w-64">
                                    <div className="grid grid-cols-8 gap-1">
                                      {COURSE_EMOJIS.map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() => {
                                            setEditCourseEmoji(emoji);
                                            setShowEditEmojiPicker(false);
                                          }}
                                          className={`w-7 h-7 rounded-lg hover:bg-[#F5F1E8] flex items-center justify-center transition-colors ${
                                            editCourseEmoji === emoji ? "bg-[#7CB342]/20" : ""
                                          }`}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <Input
                                value={editCourseName}
                                onChange={(e) => setEditCourseName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRenameCourse(course.id);
                                  if (e.key === "Escape") {
                                    setEditingCourseId(null);
                                    setEditCourseName("");
                                    setEditCourseEmoji("");
                                    setShowEditEmojiPicker(false);
                                  }
                                }}
                                className="h-10 text-sm rounded-xl border-[#D7CFC0] focus:border-[#7CB342] focus:ring-[#7CB342]/20"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRenameCourse(course.id)}
                                className="h-10 w-10 p-0 rounded-full text-[#7CB342] hover:bg-[#7CB342]/10"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingCourseId(null);
                                  setEditCourseName("");
                                  setEditCourseEmoji("");
                                  setShowEditEmojiPicker(false);
                                }}
                                className="h-10 w-10 p-0 rounded-full text-[#8B7355] hover:bg-[#EBE4D6]"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <button
                                onClick={() => {
                                  setSelectedCourseId(course.id);
                                  setSelectedDeckId(null);
                                }}
                                className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center gap-3 ${
                                  selectedCourseId === course.id
                                    ? "bg-[#7CB342]/10 text-[#689F38] shadow-sm"
                                    : "text-[#4A3426] hover:bg-[#F5F1E8]"
                                }`}
                              >
                                <div className={`w-10 h-10 rounded-xl ${gradientClass} shadow-sm flex items-center justify-center text-xl`}>
                                  {course.emoji}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium block truncate">{course.name}</span>
                                  <span className="text-xs text-[#8B7355]">{courseFileCount} files</span>
                                </div>
                              </button>

                              {/* Course actions (show on hover) */}
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white rounded-full shadow-soft px-1 py-0.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCourseId(course.id);
                                    setEditCourseName(course.name);
                                    setEditCourseEmoji(course.emoji);
                                  }}
                                  className="p-1.5 rounded-full text-[#8B7355] hover:text-[#4A3426] hover:bg-[#F5F1E8] transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCourseClick(course.id);
                                  }}
                                  className="p-1.5 rounded-full text-[#8B7355] hover:text-[#E57373] hover:bg-[#E57373]/10 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Course study stats & button */}
                            {stats?.total > 0 && (
                              <div className="flex items-center gap-2 px-4 py-2 ml-12">
                                <div className="flex-1 flex items-center gap-2">
                                  {stats.mastery.percentage > 0 && (
                                    <span className="text-xs font-semibold" style={{ color: stats.mastery.color }}>
                                      {stats.mastery.percentage}%
                                    </span>
                                  )}
                                  <span className="text-xs text-[#8B7355]">{stats.total} cards</span>
                                  {stats.mastered > 0 && (
                                    <span className="text-xs text-[#7CB342]">🏆 {stats.mastered}</span>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openStudyModal("course", course.id);
                                  }}
                                  className="text-xs px-3 py-1.5 rounded-full bg-[#7CB342]/10 text-[#689F38] hover:bg-[#7CB342]/20 transition-colors font-medium"
                                >
                                  Study
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* New course input */}
                  {showNewCourse && (
                    <div className="px-3 py-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`w-10 h-10 rounded-xl ${GRADIENT_CLASSES[courses.length % GRADIENT_CLASSES.length]} flex items-center justify-center text-xl hover:scale-105 transition-transform`}
                          >
                            {newCourseEmoji}
                          </button>
                          {showEmojiPicker && (
                            <div className="absolute top-12 left-0 z-50 p-3 bg-white rounded-2xl shadow-soft-lg border border-[#EBE4D6] w-64">
                              <div className="grid grid-cols-8 gap-1">
                                {COURSE_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => {
                                      setNewCourseEmoji(emoji);
                                      setShowEmojiPicker(false);
                                    }}
                                    className={`w-7 h-7 rounded-lg hover:bg-[#F5F1E8] flex items-center justify-center transition-colors ${
                                      newCourseEmoji === emoji ? "bg-[#7CB342]/20" : ""
                                    }`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <Input
                          value={newCourseName}
                          onChange={(e) => setNewCourseName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateCourse();
                            if (e.key === "Escape") {
                              setShowNewCourse(false);
                              setNewCourseName("");
                              setNewCourseEmoji("📚");
                              setShowEmojiPicker(false);
                            }
                          }}
                          placeholder="Course name..."
                          className="h-10 text-sm rounded-xl border-[#D7CFC0] focus:border-[#7CB342] focus:ring-[#7CB342]/20"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCreateCourse}
                          className="h-10 w-10 p-0 rounded-full text-[#7CB342] hover:bg-[#7CB342]/10"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setShowNewCourse(false);
                            setNewCourseName("");
                            setNewCourseEmoji("📚");
                            setShowEmojiPicker(false);
                          }}
                          className="h-10 w-10 p-0 rounded-full text-[#8B7355] hover:bg-[#EBE4D6]"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                      <p className="text-xs text-[#8B7355] ml-12">Click emoji to change</p>
                    </div>
                  )}

                  {courses.length === 0 && !showNewCourse && (
                    <p className="text-sm text-[#8B7355] px-4 py-3 text-center">
                      No courses yet. Create one to organize your files.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Custom Decks Card */}
              <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-br from-[#F3E5F5] to-[#E1BEE7]">
                  <CardTitle className="text-[#2C1810] text-lg font-serif flex items-center justify-between">
                    Custom Decks
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDeckModal()}
                      className="h-8 w-8 p-0 rounded-full text-[#8B7355] hover:text-[#4A3426] hover:bg-white/50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 p-3">
                  {decks.map((deck, index) => {
                    const stats = courseStats[`deck:${deck.id}`];
                    const gradientClass = GRADIENT_CLASSES[(index + courses.length) % GRADIENT_CLASSES.length];
                    
                    return (
                      <div key={deck.id} className="group">
                        <div className="relative">
                          <button
                            onClick={() => {
                              setSelectedDeckId(deck.id);
                              setSelectedCourseId(null);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-2xl transition-all flex items-center gap-3 ${
                              selectedDeckId === deck.id
                                ? "bg-[#7CB342]/10 text-[#689F38] shadow-sm"
                                : "text-[#4A3426] hover:bg-[#F5F1E8]"
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl ${gradientClass} shadow-sm flex items-center justify-center`}>
                              <span className="text-lg">📚</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium block truncate">{deck.name}</span>
                              <span className="text-xs text-[#8B7355]">{stats?.total || 0} cards</span>
                            </div>
                          </button>

                          {/* Deck actions (show on hover) */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-white rounded-full shadow-soft px-1 py-0.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openFlashcardModal(null, deck.id);
                              }}
                              className="p-1.5 rounded-full text-[#8B7355] hover:text-[#7CB342] hover:bg-[#7CB342]/10 transition-colors"
                              title="Add card"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeckModal(deck);
                              }}
                              className="p-1.5 rounded-full text-[#8B7355] hover:text-[#4A3426] hover:bg-[#F5F1E8] transition-colors"
                              title="Edit deck"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ type: "deck", id: deck.id, preview: deck.name });
                              }}
                              className="p-1.5 rounded-full text-[#8B7355] hover:text-[#E57373] hover:bg-[#E57373]/10 transition-colors"
                              title="Delete deck"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Deck study stats & button */}
                        {stats?.total > 0 && (
                          <div className="flex items-center gap-2 px-4 py-2 ml-12">
                            <div className="flex-1 flex items-center gap-2">
                              {stats.mastery.percentage > 0 && (
                                <span className="text-xs font-semibold" style={{ color: stats.mastery.color }}>
                                  {stats.mastery.percentage}%
                                </span>
                              )}
                              <span className="text-xs text-[#8B7355]">{stats.total} cards</span>
                              {stats.mastered > 0 && (
                                <span className="text-xs text-[#7CB342]">🏆 {stats.mastered}</span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openStudyModal("deck", deck.id);
                              }}
                              className="text-xs px-3 py-1.5 rounded-full bg-[#7CB342]/10 text-[#689F38] hover:bg-[#7CB342]/20 transition-colors font-medium"
                            >
                              Study
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {decks.length === 0 && (
                    <p className="text-sm text-[#8B7355] px-4 py-3 text-center">
                      No custom decks yet. Create one for standalone flashcards.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main content area */}
            <div className="flex-1 space-y-6">
              {/* Upload section */}
              <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9]">
                  <CardTitle className="text-[#2C1810] font-serif flex items-center gap-2">
                    Upload File
                    {selectedCourse && (
                      <span className="text-sm font-normal text-[#4A3426]">
                        to{" "}
                        <span className="font-medium text-[#689F38]">
                          {selectedCourse.name}
                        </span>
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <FileUpload userId={user.uid} courseId={selectedCourseId || undefined} />
                </CardContent>
              </Card>

              {/* Files list */}
              <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-br from-[#FFF8E1] to-[#FFECB3]">
                  <CardTitle className="text-[#2C1810] font-serif flex items-center gap-3">
                    {selectedCourse ? (
                      <>
                        <div className={`w-10 h-10 rounded-xl ${GRADIENT_CLASSES[courses.indexOf(selectedCourse) % GRADIENT_CLASSES.length]} flex items-center justify-center text-xl`}>
                          {selectedCourse.emoji}
                        </div>
                        {selectedCourse.name}
                      </>
                    ) : (
                      "All Files"
                    )}
                    <span className="text-sm font-normal text-[#8B7355]">
                      ({filteredFiles.length} {filteredFiles.length === 1 ? "file" : "files"})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <FileList
                    files={filteredFiles}
                    generating={generating}
                    onGenerateFlashcards={handleGenerateFlashcards}
                    onDeleteFile={handleDeleteFile}
                    onRenameFile={handleRenameFile}
                    onViewFlashcards={(fileId) => {
                      openStudyModal("file", fileId);
                    }}
                    flashcardCounts={flashcards.reduce(
                      (acc, fc) => {
                        if (fc.fileId) {
                          acc[fc.fileId] = (acc[fc.fileId] || 0) + 1;
                        }
                        return acc;
                      },
                      {} as Record<string, number>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Stats sidebar */}
            <div className="w-72 flex-shrink-0 space-y-6">
              {/* Context-aware stats based on selected course */}
              {(() => {
                const currentStats = selectedCourseId 
                  ? courseStats[selectedCourseId] 
                  : courseStats["all"];
                const currentFlashcards = selectedCourseId
                  ? flashcards.filter(f => f.courseId === selectedCourseId)
                  : flashcards;
                const currentFiles = selectedCourseId
                  ? files.filter(f => f.courseId === selectedCourseId)
                  : files;

                return (
                  <>
                    <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
                      <CardHeader className="bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB]">
                        <CardTitle className="text-[#2C1810] text-lg font-serif">
                          {selectedCourseId ? `${selectedCourse?.name} Stats` : "Quick Stats"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-5">
                        <div className="flex justify-between items-center">
                          <span className="text-[#8B7355]">Files</span>
                          <span className="text-3xl font-bold text-[#2C1810] font-serif">{currentFiles.length}</span>
                        </div>
                        {!selectedCourseId && (
                          <div className="flex justify-between items-center">
                            <span className="text-[#8B7355]">Courses</span>
                            <span className="text-3xl font-bold text-[#2C1810] font-serif">{courses.length}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-[#8B7355]">Flashcards</span>
                          <span className="text-3xl font-bold text-[#7CB342] font-serif">
                            {currentFlashcards.length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#8B7355]">Mastered</span>
                          <span className="text-3xl font-bold text-[#FFB74D] font-serif">
                            {currentFlashcards.filter((f) => f.mastered).length}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {currentFlashcards.length > 0 && (
                      <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
                        <CardHeader className="bg-gradient-to-br from-[#E0F2F1] to-[#B2DFDB]">
                          <CardTitle className="text-[#2C1810] text-lg font-serif">Study</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <Button
                            onClick={() => openStudyModal(selectedCourseId ? "course" : "all", selectedCourseId)}
                            className="w-full rounded-2xl h-12 bg-[#7CB342] hover:bg-[#689F38] text-white font-semibold shadow-soft transition-all hover:shadow-soft-lg hover:-translate-y-0.5"
                          >
                            🧠 Smart Study
                          </Button>
                          <p className="text-xs text-[#8B7355] text-center">
                            Prioritizes weak cards & due for review
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {/* Progress - context aware */}
                    {currentStats?.total > 0 && currentStats.mastery.percentage > 0 && (
                      <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
                        <CardHeader className="bg-gradient-to-br from-[#FCE4EC] to-[#F8BBD9]">
                          <CardTitle className="text-[#2C1810] text-lg font-serif">
                            {selectedCourseId ? "Course Progress" : "Overall Progress"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                          <div className="text-center">
                            <span
                              className="text-5xl font-bold font-serif"
                              style={{ color: currentStats.mastery.color }}
                            >
                              {currentStats.mastery.percentage}%
                            </span>
                            <p className="text-sm text-[#8B7355] mt-1">Mastery</p>
                          </div>
                          <div className="w-full h-3 bg-[#EBE4D6] rounded-full overflow-hidden">
                            <div
                              className="h-full transition-all duration-500 rounded-full"
                              style={{
                                width: `${currentStats.mastery.percentage}%`,
                                backgroundColor: currentStats.mastery.color,
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-[#8B7355]">
                            <span>{currentStats.mastered} mastered</span>
                            <span>{currentStats.total - currentStats.mastered} remaining</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
