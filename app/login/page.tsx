"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        toast.success("Account created successfully!");
      } else {
        await signIn(email, password);
        toast.success("Welcome back!");
      }
      router.push("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F1E8] p-4">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-br from-[#FFF9C4] to-[#F0E68C] opacity-60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] opacity-60 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-gradient-to-br from-[#FFE0B2] to-[#FFCCBC] opacity-30 blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-soft-lg border-0 animate-slide-up">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto mb-6 w-16 h-16 rounded-2xl gradient-beige flex items-center justify-center shadow-soft">
            <svg
              className="w-8 h-8 text-[#4A3426]"
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
          <CardTitle className="text-3xl text-[#2C1810] font-serif">Collate</CardTitle>
          <CardDescription className="text-[#8B7355] text-base mt-2">
            {isSignUp
              ? "Create an account to start studying smarter"
              : "Sign in to access your study materials"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#4A3426] font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-2xl bg-[#F5F1E8] border-0 text-[#2C1810] placeholder:text-[#A69178] focus:ring-2 focus:ring-[#7CB342]/30 focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#4A3426] font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 rounded-2xl bg-[#F5F1E8] border-0 text-[#2C1810] placeholder:text-[#A69178] focus:ring-2 focus:ring-[#7CB342]/30 focus:bg-white transition-all"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-[#7CB342] hover:bg-[#689F38] text-white font-semibold text-base shadow-soft transition-all hover:shadow-soft-lg hover:-translate-y-0.5 mt-2"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </span>
              ) : isSignUp ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-[#8B7355] hover:text-[#7CB342] transition-colors font-medium"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
