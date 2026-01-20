import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Course, FileDocument, Flashcard, Deck } from "@/app/dashboard/page";

// Types for deleted data (used for undo)
export interface DeletedCourseData {
  type: "course";
  course: Course;
  files: FileDocument[];
  flashcards: Flashcard[];
  timestamp: number;
}

export interface DeletedFileData {
  type: "file";
  file: FileDocument;
  flashcards: Flashcard[];
  timestamp: number;
}

export interface DeletedDeckData {
  type: "deck";
  deck: Deck;
  flashcards: Flashcard[];
  timestamp: number;
}

export type DeletedData = DeletedCourseData | DeletedFileData | DeletedDeckData;

// Store for undo functionality
let lastDeletedData: DeletedData | null = null;
let undoTimeout: NodeJS.Timeout | null = null;

export function getLastDeletedData(): DeletedData | null {
  return lastDeletedData;
}

export function clearUndoData(): void {
  lastDeletedData = null;
  if (undoTimeout) {
    clearTimeout(undoTimeout);
    undoTimeout = null;
  }
}

// Set undo data with 10 second expiration
function setUndoData(data: DeletedData): void {
  lastDeletedData = data;
  
  // Clear any existing timeout
  if (undoTimeout) {
    clearTimeout(undoTimeout);
  }
  
  // Auto-clear after 10 seconds
  undoTimeout = setTimeout(() => {
    lastDeletedData = null;
    undoTimeout = null;
  }, 10000);
}

/**
 * Delete a course and all its associated data (files, flashcards)
 * Keeps ratings for analytics purposes
 */
export async function deleteCourseWithCascade(
  userId: string,
  courseId: string,
  courseData: Course,
  allFiles: FileDocument[],
  allFlashcards: Flashcard[],
  onProgress?: (message: string) => void
): Promise<void> {
  // Get files and flashcards for this course
  const courseFiles = allFiles.filter((f) => f.courseId === courseId);
  const courseFlashcards = allFlashcards.filter((f) => f.courseId === courseId);
  
  // Store for undo
  setUndoData({
    type: "course",
    course: courseData,
    files: courseFiles,
    flashcards: courseFlashcards,
    timestamp: Date.now(),
  });

  try {
    // Step 1: Delete files from Firebase Storage
    onProgress?.("Deleting files from storage...");
    for (const file of courseFiles) {
      try {
        const storageRef = ref(storage, file.storagePath);
        await deleteObject(storageRef);
      } catch (error) {
        // File might not exist in storage, continue anyway
        console.warn(`Could not delete storage file: ${file.storagePath}`, error);
      }
    }

    // Step 2: Delete flashcards in batches (max 500 per batch)
    onProgress?.(`Deleting ${courseFlashcards.length} flashcards...`);
    await batchDeleteDocuments(
      userId,
      "flashcards",
      courseFlashcards.map((f) => f.id)
    );

    // Step 3: Delete file documents in batches
    onProgress?.(`Deleting ${courseFiles.length} files...`);
    await batchDeleteDocuments(
      userId,
      "files",
      courseFiles.map((f) => f.id)
    );

    // Step 4: Delete the course document
    onProgress?.("Finalizing...");
    await deleteDoc(doc(db, "users", userId, "courses", courseId));

  } catch (error) {
    // Clear undo data on failure
    clearUndoData();
    throw error;
  }
}

/**
 * Delete a file and all its associated flashcards
 * Keeps ratings for analytics purposes
 */
export async function deleteFileWithCascade(
  userId: string,
  fileId: string,
  fileData: FileDocument,
  allFlashcards: Flashcard[],
  onProgress?: (message: string) => void
): Promise<void> {
  // Get flashcards for this file
  const fileFlashcards = allFlashcards.filter((f) => f.fileId === fileId);
  
  // Store for undo
  setUndoData({
    type: "file",
    file: fileData,
    flashcards: fileFlashcards,
    timestamp: Date.now(),
  });

  try {
    // Step 1: Delete file from Firebase Storage
    onProgress?.("Deleting file from storage...");
    try {
      const storageRef = ref(storage, fileData.storagePath);
      await deleteObject(storageRef);
    } catch (error) {
      console.warn(`Could not delete storage file: ${fileData.storagePath}`, error);
    }

    // Step 2: Delete flashcards in batches
    onProgress?.(`Deleting ${fileFlashcards.length} flashcards...`);
    await batchDeleteDocuments(
      userId,
      "flashcards",
      fileFlashcards.map((f) => f.id)
    );

    // Step 3: Delete the file document
    onProgress?.("Finalizing...");
    await deleteDoc(doc(db, "users", userId, "files", fileId));

  } catch (error) {
    clearUndoData();
    throw error;
  }
}

/**
 * Delete a deck and all its associated flashcards
 * Keeps ratings for analytics purposes
 */
export async function deleteDeckWithCascade(
  userId: string,
  deckId: string,
  deckData: Deck,
  allFlashcards: Flashcard[],
  onProgress?: (message: string) => void
): Promise<void> {
  // Get flashcards for this deck
  const deckFlashcards = allFlashcards.filter((f) => f.deckId === deckId);
  
  // Store for undo
  setUndoData({
    type: "deck",
    deck: deckData,
    flashcards: deckFlashcards,
    timestamp: Date.now(),
  });

  try {
    // Step 1: Delete flashcards in batches
    onProgress?.(`Deleting ${deckFlashcards.length} flashcards...`);
    await batchDeleteDocuments(
      userId,
      "flashcards",
      deckFlashcards.map((f) => f.id)
    );

    // Step 2: Delete the deck document
    onProgress?.("Finalizing...");
    await deleteDoc(doc(db, "users", userId, "decks", deckId));

  } catch (error) {
    clearUndoData();
    throw error;
  }
}

/**
 * Restore deleted data (undo functionality)
 */
export async function restoreDeletedData(userId: string): Promise<boolean> {
  const data = lastDeletedData;
  if (!data) return false;

  try {
    if (data.type === "course") {
      // Restore course
      await setDoc(doc(db, "users", userId, "courses", data.course.id), {
        name: data.course.name,
        color: data.course.color,
        emoji: data.course.emoji,
        createdAt: Timestamp.fromDate(data.course.createdAt),
      });

      // Restore files
      for (const file of data.files) {
        await setDoc(doc(db, "users", userId, "files", file.id), {
          name: file.name,
          size: file.size,
          fileType: file.fileType,
          storagePath: file.storagePath,
          downloadUrl: file.downloadUrl,
          extractedText: file.extractedText,
          status: file.status,
          courseId: file.courseId,
          uploadedAt: Timestamp.fromDate(file.uploadedAt),
        });
      }

      // Restore flashcards
      for (const flashcard of data.flashcards) {
        await setDoc(doc(db, "users", userId, "flashcards", flashcard.id), {
          fileId: flashcard.fileId,
          fileName: flashcard.fileName,
          courseId: flashcard.courseId,
          courseName: flashcard.courseName,
          deckId: flashcard.deckId,
          type: flashcard.type,
          question: flashcard.question,
          answer: flashcard.answer,
          source: flashcard.source,
          isEdited: flashcard.isEdited,
          originalQuestion: flashcard.originalQuestion,
          originalAnswer: flashcard.originalAnswer,
          createdAt: Timestamp.fromDate(flashcard.createdAt),
          updatedAt: flashcard.updatedAt ? Timestamp.fromDate(flashcard.updatedAt) : null,
          latestRating: flashcard.latestRating,
          ratingCount: flashcard.ratingCount,
          consecutiveFives: flashcard.consecutiveFives,
          averageRating: flashcard.averageRating,
          mastered: flashcard.mastered,
          masteredAt: flashcard.masteredAt ? Timestamp.fromDate(flashcard.masteredAt) : null,
          nextReviewAt: flashcard.nextReviewAt ? Timestamp.fromDate(flashcard.nextReviewAt) : null,
        });
      }
    } else if (data.type === "file") {
      // Restore file
      await setDoc(doc(db, "users", userId, "files", data.file.id), {
        name: data.file.name,
        size: data.file.size,
        fileType: data.file.fileType,
        storagePath: data.file.storagePath,
        downloadUrl: data.file.downloadUrl,
        extractedText: data.file.extractedText,
        status: data.file.status,
        courseId: data.file.courseId,
        uploadedAt: Timestamp.fromDate(data.file.uploadedAt),
      });

      // Restore flashcards
      for (const flashcard of data.flashcards) {
        await setDoc(doc(db, "users", userId, "flashcards", flashcard.id), {
          fileId: flashcard.fileId,
          fileName: flashcard.fileName,
          courseId: flashcard.courseId,
          courseName: flashcard.courseName,
          deckId: flashcard.deckId,
          type: flashcard.type,
          question: flashcard.question,
          answer: flashcard.answer,
          source: flashcard.source,
          isEdited: flashcard.isEdited,
          originalQuestion: flashcard.originalQuestion,
          originalAnswer: flashcard.originalAnswer,
          createdAt: Timestamp.fromDate(flashcard.createdAt),
          updatedAt: flashcard.updatedAt ? Timestamp.fromDate(flashcard.updatedAt) : null,
          latestRating: flashcard.latestRating,
          ratingCount: flashcard.ratingCount,
          consecutiveFives: flashcard.consecutiveFives,
          averageRating: flashcard.averageRating,
          mastered: flashcard.mastered,
          masteredAt: flashcard.masteredAt ? Timestamp.fromDate(flashcard.masteredAt) : null,
          nextReviewAt: flashcard.nextReviewAt ? Timestamp.fromDate(flashcard.nextReviewAt) : null,
        });
      }
    } else if (data.type === "deck") {
      // Restore deck
      await setDoc(doc(db, "users", userId, "decks", data.deck.id), {
        name: data.deck.name,
        description: data.deck.description,
        color: data.deck.color,
        createdAt: Timestamp.fromDate(data.deck.createdAt),
        updatedAt: data.deck.updatedAt ? Timestamp.fromDate(data.deck.updatedAt) : null,
      });

      // Restore flashcards
      for (const flashcard of data.flashcards) {
        await setDoc(doc(db, "users", userId, "flashcards", flashcard.id), {
          fileId: flashcard.fileId,
          fileName: flashcard.fileName,
          courseId: flashcard.courseId,
          courseName: flashcard.courseName,
          deckId: flashcard.deckId,
          type: flashcard.type,
          question: flashcard.question,
          answer: flashcard.answer,
          source: flashcard.source,
          isEdited: flashcard.isEdited,
          originalQuestion: flashcard.originalQuestion,
          originalAnswer: flashcard.originalAnswer,
          createdAt: Timestamp.fromDate(flashcard.createdAt),
          updatedAt: flashcard.updatedAt ? Timestamp.fromDate(flashcard.updatedAt) : null,
          latestRating: flashcard.latestRating,
          ratingCount: flashcard.ratingCount,
          consecutiveFives: flashcard.consecutiveFives,
          averageRating: flashcard.averageRating,
          mastered: flashcard.mastered,
          masteredAt: flashcard.masteredAt ? Timestamp.fromDate(flashcard.masteredAt) : null,
          nextReviewAt: flashcard.nextReviewAt ? Timestamp.fromDate(flashcard.nextReviewAt) : null,
        });
      }
    }

    // Clear undo data after successful restore
    clearUndoData();
    return true;
  } catch (error) {
    console.error("Failed to restore deleted data:", error);
    return false;
  }
}

/**
 * Helper function to delete documents in batches (Firestore limit: 500 per batch)
 */
async function batchDeleteDocuments(
  userId: string,
  collectionName: string,
  docIds: string[]
): Promise<void> {
  const BATCH_SIZE = 500;
  
  for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const batchIds = docIds.slice(i, i + BATCH_SIZE);
    
    for (const docId of batchIds) {
      const docRef = doc(db, "users", userId, collectionName, docId);
      batch.delete(docRef);
    }
    
    await batch.commit();
  }
}

/**
 * One-time cleanup script to remove orphaned data
 * Run this once to clean up flashcards that belong to deleted courses/files
 */
export async function cleanupOrphanedData(userId: string): Promise<{
  orphanedFlashcards: number;
  orphanedFiles: number;
}> {
  let orphanedFlashcards = 0;
  let orphanedFiles = 0;

  // Get all current courses and files
  const coursesSnapshot = await getDocs(collection(db, "users", userId, "courses"));
  const filesSnapshot = await getDocs(collection(db, "users", userId, "files"));
  const flashcardsSnapshot = await getDocs(collection(db, "users", userId, "flashcards"));
  const decksSnapshot = await getDocs(collection(db, "users", userId, "decks"));

  const validCourseIds = new Set(coursesSnapshot.docs.map((d) => d.id));
  const validFileIds = new Set(filesSnapshot.docs.map((d) => d.id));
  const validDeckIds = new Set(decksSnapshot.docs.map((d) => d.id));

  // Find orphaned files (courseId doesn't exist)
  const orphanedFileIds: string[] = [];
  filesSnapshot.docs.forEach((fileDoc) => {
    const data = fileDoc.data();
    if (data.courseId && !validCourseIds.has(data.courseId)) {
      orphanedFileIds.push(fileDoc.id);
    }
  });

  // Find orphaned flashcards
  const orphanedFlashcardIds: string[] = [];
  flashcardsSnapshot.docs.forEach((flashcardDoc) => {
    const data = flashcardDoc.data();
    
    // Check if file reference is orphaned
    if (data.fileId && !validFileIds.has(data.fileId)) {
      orphanedFlashcardIds.push(flashcardDoc.id);
      return;
    }
    
    // Check if course reference is orphaned
    if (data.courseId && !validCourseIds.has(data.courseId)) {
      orphanedFlashcardIds.push(flashcardDoc.id);
      return;
    }
    
    // Check if deck reference is orphaned
    if (data.deckId && !validDeckIds.has(data.deckId)) {
      orphanedFlashcardIds.push(flashcardDoc.id);
      return;
    }
  });

  // Delete orphaned flashcards
  if (orphanedFlashcardIds.length > 0) {
    await batchDeleteDocuments(userId, "flashcards", orphanedFlashcardIds);
    orphanedFlashcards = orphanedFlashcardIds.length;
  }

  // Delete orphaned files
  if (orphanedFileIds.length > 0) {
    await batchDeleteDocuments(userId, "files", orphanedFileIds);
    orphanedFiles = orphanedFileIds.length;
  }

  return { orphanedFlashcards, orphanedFiles };
}

