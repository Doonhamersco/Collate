"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FileDocument } from "@/app/dashboard/page";

interface FileListProps {
  files: FileDocument[];
  generating: string | null;
  onGenerateFlashcards: (fileId: string) => void;
  onDeleteFile: (fileId: string) => void;
  onViewFlashcards: (fileId: string) => void;
  onRenameFile: (fileId: string, newName: string) => void;
  flashcardCounts: Record<string, number>;
}

export function FileList({
  files,
  generating,
  onGenerateFlashcards,
  onDeleteFile,
  onViewFlashcards,
  onRenameFile,
  flashcardCounts,
}: FileListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEditing = (file: FileDocument) => {
    setEditingId(file.id);
    setEditName(file.name);
  };

  const saveEdit = (fileId: string) => {
    if (editName.trim()) {
      onRenameFile(fileId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, fileId: string) => {
    if (e.key === "Enter") {
      saveEdit(fileId);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-slate-400">No files uploaded yet</p>
        <p className="text-sm text-slate-500 mt-1">
          Upload a PDF to get started
        </p>
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: FileDocument["status"]) => {
    switch (status) {
      case "uploading":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
            Uploading
          </span>
        );
      case "processing":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing
          </span>
        );
      case "ready":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
            Ready
          </span>
        );
      case "failed":
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">
            Failed
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {files.map((file) => {
        const cardCount = flashcardCounts[file.id] || 0;
        const isGenerating = generating === file.id;
        const isEditing = editingId === file.id;

        return (
          <div
            key={file.id}
            className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-slate-600 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* PDF Icon */}
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-5 h-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
                  <path d="M8.5 13.5c0-.83.67-1.5 1.5-1.5.39 0 .74.15 1.01.39.27-.24.62-.39 1.01-.39.83 0 1.5.67 1.5 1.5 0 .47-.22.89-.56 1.16l-1.95 1.55-1.95-1.55c-.34-.27-.56-.69-.56-1.16z" />
                </svg>
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, file.id)}
                        className="h-8 bg-slate-800 border-slate-600 text-white text-sm"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveEdit(file.id)}
                        className="h-8 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        className="h-8 px-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-white font-medium truncate">{file.name}</h3>
                      <button
                        onClick={() => startEditing(file)}
                        className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                        title="Rename file"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {getStatusBadge(file.status)}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                  <span>{formatSize(file.size)}</span>
                  <span>•</span>
                  <span>
                    {file.uploadedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {cardCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-amber-400">{cardCount} flashcards</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {file.status === "ready" && (
                  <>
                    {cardCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onViewFlashcards(file.id)}
                        className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                      >
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        Study
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => onGenerateFlashcards(file.id)}
                      disabled={isGenerating}
                      className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-medium"
                    >
                      {isGenerating ? (
                        <>
                          <svg className="w-4 h-4 mr-1 animate-spin" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                          Generate
                        </>
                      )}
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDeleteFile(file.id)}
                  className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
