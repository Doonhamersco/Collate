"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cleanupOrphanedData } from "@/lib/cascading-delete";
import { toast } from "sonner";

export default function CleanupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{
    orphanedFlashcards: number;
    orphanedFiles: number;
  } | null>(null);

  const handleRunCleanup = async () => {
    if (!user) return;

    setRunning(true);
    setResults(null);

    try {
      const cleanupResults = await cleanupOrphanedData(user.uid);
      setResults(cleanupResults);

      const totalCleaned = cleanupResults.orphanedFlashcards + cleanupResults.orphanedFiles;
      if (totalCleaned > 0) {
        toast.success(`Cleaned up ${totalCleaned} orphaned items!`);
      } else {
        toast.info("No orphaned data found - your data is clean!");
      }
    } catch (error) {
      console.error("Cleanup failed:", error);
      toast.error("Cleanup failed. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F1E8]">
        <p className="text-[#8B7355]">Loading...</p>
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F1E8] p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="text-[#8B7355] hover:text-[#4A3426] hover:bg-[#EBE4D6] rounded-full"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Button>

        <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-br from-[#FFEBEE] to-[#FFCDD2]">
            <CardTitle className="text-[#2C1810] font-serif flex items-center gap-2">
              <span>🧹</span>
              Data Cleanup Utility
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <p className="text-[#4A3426]">
                This utility finds and removes orphaned data from your account:
              </p>
              <ul className="list-disc list-inside text-sm text-[#8B7355] space-y-1 ml-2">
                <li>Flashcards that belong to deleted courses</li>
                <li>Flashcards that belong to deleted files</li>
                <li>Flashcards that belong to deleted decks</li>
                <li>Files that belong to deleted courses</li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF8E1] flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <div className="text-sm">
                <p className="font-semibold text-[#F9A825]">One-time cleanup</p>
                <p className="text-[#8B7355] mt-1">
                  This is designed to clean up data from before cascading deletes were implemented.
                  You typically only need to run this once.
                </p>
              </div>
            </div>

            <Button
              onClick={handleRunCleanup}
              disabled={running}
              className="w-full rounded-2xl h-12 bg-[#E57373] hover:bg-[#EF5350] text-white font-semibold shadow-soft transition-all"
            >
              {running ? (
                <>
                  <svg className="w-5 h-5 mr-2 animate-spin" viewBox="0 0 24 24">
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
                  Running Cleanup...
                </>
              ) : (
                <>
                  🧹 Run Cleanup
                </>
              )}
            </Button>

            {/* Results */}
            {results !== null && (
              <div className="p-4 rounded-2xl bg-[#E8F5E9] space-y-3">
                <p className="font-semibold text-[#2E7D32] flex items-center gap-2">
                  <span>✅</span> Cleanup Complete
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 rounded-xl bg-white/50">
                    <p className="text-[#8B7355]">Orphaned Flashcards</p>
                    <p className="text-2xl font-bold text-[#2C1810]">{results.orphanedFlashcards}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/50">
                    <p className="text-[#8B7355]">Orphaned Files</p>
                    <p className="text-2xl font-bold text-[#2C1810]">{results.orphanedFiles}</p>
                  </div>
                </div>
                {results.orphanedFlashcards === 0 && results.orphanedFiles === 0 && (
                  <p className="text-sm text-[#4A3426] text-center mt-2">
                    🎉 Your data is already clean!
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

