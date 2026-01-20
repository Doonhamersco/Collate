"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { storage, db } from "@/lib/firebase";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const SUPPORTED_TYPES = {
  "application/pdf": { ext: ".pdf", label: "PDF" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: ".docx", label: "DOCX" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: ".pptx", label: "PPTX" },
};

interface FileUploadProps {
  userId: string;
  courseId?: string;
}

export function FileUpload({ userId, courseId }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  const processFile = async (file: File, fileId: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);
    formData.append("fileId", fileId);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to extract text");
      }

      const result = await response.json();

      // Update the file document with extracted text
      await updateDoc(doc(db, "users", userId, "files", fileId), {
        extractedText: result.text,
        status: "ready",
      });

      toast.success("Text extracted successfully!");
    } catch (error) {
      console.error("Extraction error:", error);
      await updateDoc(doc(db, "users", userId, "files", fileId), {
        status: "failed",
      });
      throw error;
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Validate file type
      const supportedType = SUPPORTED_TYPES[file.type as keyof typeof SUPPORTED_TYPES];
      if (!supportedType) {
        toast.error("Only PDF, DOCX, and PPTX files are supported");
        return;
      }

      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error("File size must be less than 50MB");
        return;
      }

      setUploading(true);
      setProgress(0);
      setCurrentFile(file.name);

      try {
        // Generate a unique file ID
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const storagePath = `users/${userId}/files/${fileId}/${file.name}`;
        const storageRef = ref(storage, storagePath);

        // Create file document with uploading status
        await setDoc(doc(db, "users", userId, "files", fileId), {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          fileType: supportedType.label.toLowerCase(),
          storagePath,
          downloadUrl: "",
          extractedText: "",
          status: "uploading",
          courseId: courseId || null,
          uploadedAt: serverTimestamp(),
        });

        // Upload file to Firebase Storage
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(progress);
          },
          (error) => {
            console.error("Upload error:", error);
            toast.error("Failed to upload file");
            setUploading(false);
            setCurrentFile(null);
          },
          async () => {
            // Upload completed, get download URL
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

            // Update file document
            await updateDoc(doc(db, "users", userId, "files", fileId), {
              downloadUrl,
              status: "processing",
            });

            toast.success("File uploaded! Extracting text...");

            // Extract text from file
            try {
              await processFile(file, fileId);
            } catch {
              toast.error("Failed to extract text from file");
            }

            setUploading(false);
            setCurrentFile(null);
            setProgress(0);
          }
        );
      } catch (error) {
        console.error("Error:", error);
        toast.error("An error occurred");
        setUploading(false);
        setCurrentFile(null);
      }
    },
    [userId, courseId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${
            isDragActive
              ? "border-amber-500 bg-amber-500/10"
              : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/30"
          }
          ${uploading ? "pointer-events-none opacity-50" : ""}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
              isDragActive ? "bg-amber-500/20" : "bg-slate-700"
            }`}
          >
            <svg
              className={`w-8 h-8 ${isDragActive ? "text-amber-400" : "text-slate-400"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          {isDragActive ? (
            <p className="text-amber-400 font-medium">Drop the file here...</p>
          ) : (
            <>
              <p className="text-white font-medium">
                Drag & drop a file here, or click to select
              </p>
              <p className="text-sm text-slate-400">PDF, DOCX, PPTX • max 50MB</p>
            </>
          )}
        </div>
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300 truncate max-w-[200px]">{currentFile}</span>
            <span className="text-slate-400">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-slate-700" />
        </div>
      )}
    </div>
  );
}
