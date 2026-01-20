"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, writeBatch, serverTimestamp, updateDoc, setDoc, where } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileUpload } from "@/components/file-upload";
import { FileList } from "@/components/file-list";
import { FlashcardViewer } from "@/components/flashcard-viewer";

export interface Course {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

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

export interface Flashcard {
  id: string;
  fileId: string;
  fileName: string;
  courseId: string | null;
  courseName: string | null;
  question: string;
  answer: string;
  createdAt: Date;
  // Rating fields
  latestRating: number | null;
  ratingCount: number;
  consecutiveFives: number;
  averageRating: number | null;
  mastered: boolean;
  masteredAt: Date | null;
  nextReviewAt: Date | null;
}

export interface RatingRecord {
  id: string;
  flashcardId: string;
  fileId: string;
  courseId: string | null;
  rating: number;
  timestamp: Date;
  sessionId: string;
  timeSpentMs: number;
}

const COURSE_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
];

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [files, setFiles] = useState<FileDocument[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [viewingFlashcards, setViewingFlashcards] = useState(false);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseName, setEditCourseName] = useState("");

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
          fileId: data.fileId,
          fileName: data.fileName,
          courseId: data.courseId || null,
          courseName: data.courseName || null,
          question: data.question,
          answer: data.answer,
          createdAt: data.createdAt?.toDate() || new Date(),
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

  const handleCreateCourse = async () => {
    if (!user || !newCourseName.trim()) return;

    try {
      const courseId = `course_${Date.now()}`;
      const color = COURSE_COLORS[courses.length % COURSE_COLORS.length];

      await setDoc(doc(db, "users", user.uid, "courses", courseId), {
        name: newCourseName.trim(),
        color,
        createdAt: serverTimestamp(),
      });

      setNewCourseName("");
      setShowNewCourse(false);
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
      });
      setEditingCourseId(null);
      setEditCourseName("");
      toast.success("Course renamed!");
    } catch (error) {
      toast.error("Failed to rename course");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!user) return;

    const courseFiles = files.filter((f) => f.courseId === courseId);
    if (courseFiles.length > 0) {
      toast.error("Cannot delete course with files. Move or delete files first.");
      return;
    }

    try {
      await deleteDoc(doc(db, "users", user.uid, "courses", courseId));
      if (selectedCourseId === courseId) {
        setSelectedCourseId(null);
      }
      toast.success("Course deleted!");
    } catch (error) {
      toast.error("Failed to delete course");
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
      // Delete from Storage
      const storageRef = ref(storage, file.storagePath);
      await deleteObject(storageRef).catch(() => {
        // File might not exist in storage, continue anyway
      });

      // Delete from Firestore
      await deleteDoc(doc(db, "users", user.uid, "files", fileId));

      toast.success("File deleted");
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

  const handleMoveFile = async (fileId: string, newCourseId: string | null) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, "users", user.uid, "files", fileId), {
        courseId: newCourseId,
      });
      toast.success("File moved");
    } catch (error) {
      toast.error("Failed to move file");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <p className="text-slate-400">Loading...</p>
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

  const fileFlashcards = selectedFileId
    ? flashcards.filter((f) => f.fileId === selectedFileId)
    : flashcards;

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background pattern */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMjAiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZoLTJ2LTRoMnY0em0tNiA2aC0ydi00aDJ2NHptMC02aC0ydi00aDJ2NHptLTYgNmgtMnYtNGgydjR6bTAtNmgtMnYtNGgydjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
              <svg
                className="w-5 h-5 text-slate-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Collate</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{user.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {viewingFlashcards ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => {
                  setViewingFlashcards(false);
                  setSelectedFileId(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <svg
                  className="w-4 h-4 mr-2"
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
                Back to files
              </Button>
            </div>
            <FlashcardViewer
              flashcards={fileFlashcards}
              onClose={() => {
                setViewingFlashcards(false);
                setSelectedFileId(null);
              }}
            />
          </div>
        ) : (
          <div className="flex gap-8">
            {/* Courses sidebar */}
            <div className="w-64 flex-shrink-0">
              <Card className="bg-slate-800/50 border-slate-700 sticky top-8">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-lg flex items-center justify-between">
                    Courses
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowNewCourse(true)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {/* All Files option */}
                  <button
                    onClick={() => setSelectedCourseId(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      selectedCourseId === null
                        ? "bg-amber-500/20 text-amber-400"
                        : "text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    All Files
                    <span className="ml-auto text-xs text-slate-500">{files.length}</span>
                  </button>

                  {/* Course list */}
                  {courses.map((course) => {
                    const courseFileCount = files.filter((f) => f.courseId === course.id).length;
                    const isEditing = editingCourseId === course.id;

                    return (
                      <div key={course.id} className="group relative">
                        {isEditing ? (
                          <div className="flex items-center gap-1 px-2 py-1">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: course.color }}
                            />
                            <Input
                              value={editCourseName}
                              onChange={(e) => setEditCourseName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameCourse(course.id);
                                if (e.key === "Escape") {
                                  setEditingCourseId(null);
                                  setEditCourseName("");
                                }
                              }}
                              className="h-7 text-sm bg-slate-800 border-slate-600"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRenameCourse(course.id)}
                              className="h-7 w-7 p-0 text-emerald-400"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedCourseId(course.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                              selectedCourseId === course.id
                                ? "bg-amber-500/20 text-amber-400"
                                : "text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: course.color }}
                            />
                            <span className="truncate">{course.name}</span>
                            <span className="ml-auto text-xs text-slate-500">{courseFileCount}</span>
                          </button>
                        )}

                        {/* Course actions (show on hover) */}
                        {!isEditing && (
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCourseId(course.id);
                                setEditCourseName(course.name);
                              }}
                              className="p-1 text-slate-500 hover:text-slate-300"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCourse(course.id);
                              }}
                              className="p-1 text-slate-500 hover:text-red-400"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* New course input */}
                  {showNewCourse && (
                    <div className="flex items-center gap-2 px-2 py-1">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COURSE_COLORS[courses.length % COURSE_COLORS.length] }}
                      />
                      <Input
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreateCourse();
                          if (e.key === "Escape") {
                            setShowNewCourse(false);
                            setNewCourseName("");
                          }
                        }}
                        placeholder="Course name..."
                        className="h-7 text-sm bg-slate-800 border-slate-600"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCreateCourse}
                        className="h-7 w-7 p-0 text-emerald-400"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowNewCourse(false);
                          setNewCourseName("");
                        }}
                        className="h-7 w-7 p-0 text-slate-400"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                  )}

                  {courses.length === 0 && !showNewCourse && (
                    <p className="text-sm text-slate-500 px-3 py-2">
                      No courses yet. Create one to organize your files.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Main content area */}
            <div className="flex-1 space-y-6">
              {/* Upload section */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    Upload File
                    {selectedCourse && (
                      <span className="text-sm font-normal text-slate-400">
                        to{" "}
                        <span
                          className="font-medium"
                          style={{ color: selectedCourse.color }}
                        >
                          {selectedCourse.name}
                        </span>
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FileUpload userId={user.uid} courseId={selectedCourseId || undefined} />
                </CardContent>
              </Card>

              {/* Files list */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    {selectedCourse ? (
                      <>
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: selectedCourse.color }}
                        />
                        {selectedCourse.name}
                      </>
                    ) : (
                      "All Files"
                    )}
                    <span className="text-sm font-normal text-slate-400">
                      ({filteredFiles.length} {filteredFiles.length === 1 ? "file" : "files"})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FileList
                    files={filteredFiles}
                    generating={generating}
                    onGenerateFlashcards={handleGenerateFlashcards}
                    onDeleteFile={handleDeleteFile}
                    onRenameFile={handleRenameFile}
                    onViewFlashcards={(fileId) => {
                      setSelectedFileId(fileId);
                      setViewingFlashcards(true);
                    }}
                    flashcardCounts={flashcards.reduce(
                      (acc, fc) => {
                        acc[fc.fileId] = (acc[fc.fileId] || 0) + 1;
                        return acc;
                      },
                      {} as Record<string, number>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Stats sidebar */}
            <div className="w-64 flex-shrink-0 space-y-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Files</span>
                    <span className="text-2xl font-bold text-white">{files.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Courses</span>
                    <span className="text-2xl font-bold text-white">{courses.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Flashcards</span>
                    <span className="text-2xl font-bold text-amber-400">
                      {flashcards.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Ready Files</span>
                    <span className="text-2xl font-bold text-emerald-400">
                      {files.filter((f) => f.status === "ready").length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {flashcards.length > 0 && (
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Study</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={() => setViewingFlashcards(true)}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold"
                    >
                      Review All Flashcards ({flashcards.length})
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
