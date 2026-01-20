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

const FILE_TYPE_STYLES = {
  pdf: { bg: "bg-[#FFCCBC]/30", icon: "text-[#E57373]", label: "PDF" },
  docx: { bg: "bg-[#BBDEFB]/30", icon: "text-[#64B5F6]", label: "DOCX" },
  pptx: { bg: "bg-[#FFE0B2]/30", icon: "text-[#FFB74D]", label: "PPTX" },
};

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
      <div className="text-center py-12">
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[#EBE4D6] flex items-center justify-center">
          <svg
            className="w-10 h-10 text-[#8B7355]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-[#4A3426] font-semibold text-lg">No files uploaded yet</p>
        <p className="text-sm text-[#8B7355] mt-1">
          Upload a PDF, DOCX, or PPTX to get started
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
          <span className="px-3 py-1 text-xs rounded-full bg-[#E3F2FD] text-[#1976D2] font-medium">
            Uploading
          </span>
        );
      case "processing":
        return (
          <span className="px-3 py-1 text-xs rounded-full bg-[#FFF8E1] text-[#F9A825] font-medium flex items-center gap-1.5">
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
          <span className="px-3 py-1 text-xs rounded-full bg-[#E8F5E9] text-[#689F38] font-medium">
            Ready
          </span>
        );
      case "failed":
        return (
          <span className="px-3 py-1 text-xs rounded-full bg-[#FFEBEE] text-[#E57373] font-medium">
            Failed
          </span>
        );
    }
  };

  const getFileIcon = (fileType: string) => {
    const style = FILE_TYPE_STYLES[fileType as keyof typeof FILE_TYPE_STYLES] || FILE_TYPE_STYLES.pdf;
    
    return (
      <div className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
        <svg className={`w-6 h-6 ${style.icon}`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
        </svg>
      </div>
    );
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
            className="p-4 rounded-2xl bg-[#F5F1E8] hover:bg-[#EBE4D6] transition-all duration-200 group"
          >
            <div className="flex items-start gap-4">
              {/* File Icon */}
              {getFileIcon(file.fileType)}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, file.id)}
                        className="h-9 rounded-xl border-[#D7CFC0] focus:border-[#7CB342] focus:ring-[#7CB342]/20 text-[#2C1810]"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveEdit(file.id)}
                        className="h-9 px-2 rounded-xl text-[#7CB342] hover:text-[#689F38] hover:bg-[#7CB342]/10"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEdit}
                        className="h-9 px-2 rounded-xl text-[#8B7355] hover:text-[#4A3426] hover:bg-[#D7CFC0]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-[#2C1810] font-semibold truncate">{file.name}</h3>
                      <button
                        onClick={() => startEditing(file)}
                        className="p-1.5 rounded-lg text-[#8B7355] hover:text-[#4A3426] hover:bg-white/50 transition-colors opacity-0 group-hover:opacity-100"
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
                <div className="flex items-center gap-3 mt-1.5 text-sm text-[#8B7355]">
                  <span className="font-medium">{formatSize(file.size)}</span>
                  <span className="text-[#D7CFC0]">•</span>
                  <span>
                    {file.uploadedAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {cardCount > 0 && (
                    <>
                      <span className="text-[#D7CFC0]">•</span>
                      <span className="text-[#7CB342] font-medium">{cardCount} flashcards</span>
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
                        className="rounded-xl border-[#D7CFC0] text-[#4A3426] hover:bg-white hover:border-[#7CB342] hover:text-[#689F38]"
                      >
                        <svg
                          className="w-4 h-4 mr-1.5"
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
                      className="rounded-xl bg-[#7CB342] hover:bg-[#689F38] text-white font-medium shadow-soft"
                    >
                      {isGenerating ? (
                        <>
                          <svg className="w-4 h-4 mr-1.5 animate-spin" viewBox="0 0 24 24">
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
                            className="w-4 h-4 mr-1.5"
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
                  className="rounded-xl text-[#8B7355] hover:text-[#E57373] hover:bg-[#E57373]/10 opacity-0 group-hover:opacity-100 transition-all"
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
