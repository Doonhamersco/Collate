"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { format, subDays, eachDayOfInterval, startOfDay, parseISO } from "date-fns";

interface Course {
  id: string;
  name: string;
  emoji: string;
}

interface Flashcard {
  id: string;
  courseId: string | null;
  courseName: string | null;
  mastered: boolean;
  latestRating: number | null;
  averageRating: number | null;
  ratingCount: number;
}

interface RatingRecord {
  id: string;
  flashcardId: string;
  courseId: string | null;
  rating: number;
  timestamp: Date;
}

// Helper to get date string
const getDateStr = (date: Date) => format(date, "yyyy-MM-dd");

export default function AnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [ratings, setRatings] = useState<RatingRecord[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Subscribe to courses
  useEffect(() => {
    if (!user) return;

    const coursesRef = collection(db, "users", user.uid, "courses");
    const q = query(coursesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Course[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        data.push({
          id: doc.id,
          name: d.name,
          emoji: d.emoji || "📚",
        });
      });
      setCourses(data);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to flashcards
  useEffect(() => {
    if (!user) return;

    const flashcardsRef = collection(db, "users", user.uid, "flashcards");
    const q = query(flashcardsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Flashcard[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        data.push({
          id: doc.id,
          courseId: d.courseId || null,
          courseName: d.courseName || null,
          mastered: d.mastered ?? false,
          latestRating: d.latestRating ?? null,
          averageRating: d.averageRating ?? null,
          ratingCount: d.ratingCount ?? 0,
        });
      });
      setFlashcards(data);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to ratings
  useEffect(() => {
    if (!user) return;

    const ratingsRef = collection(db, "users", user.uid, "ratings");
    const q = query(ratingsRef, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: RatingRecord[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        data.push({
          id: doc.id,
          flashcardId: d.flashcardId,
          courseId: d.courseId || null,
          rating: d.rating,
          timestamp: d.timestamp?.toDate() || new Date(),
        });
      });
      setRatings(data);
    });

    return () => unsubscribe();
  }, [user]);

  // Calculate mastery over time (last 30 days)
  const masteryOverTime = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 29);
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

    // Group ratings by date
    const ratingsByDate: Record<string, number[]> = {};
    ratings.forEach((r) => {
      const dateStr = getDateStr(r.timestamp);
      if (!ratingsByDate[dateStr]) {
        ratingsByDate[dateStr] = [];
      }
      ratingsByDate[dateStr].push(r.rating);
    });

    // Calculate cumulative average mastery per day
    let cumulativeRatings: number[] = [];
    
    return days.map((day) => {
      const dateStr = getDateStr(day);
      const dayRatings = ratingsByDate[dateStr] || [];
      cumulativeRatings = [...cumulativeRatings, ...dayRatings];
      
      const avgRating = cumulativeRatings.length > 0
        ? cumulativeRatings.reduce((a, b) => a + b, 0) / cumulativeRatings.length
        : 0;
      
      // Convert to mastery percentage (1-5 scale to 0-100%)
      const mastery = cumulativeRatings.length > 0
        ? Math.round(((avgRating - 1) / 4) * 100)
        : null;

      return {
        date: format(day, "MMM d"),
        fullDate: dateStr,
        mastery,
        cardsStudied: cumulativeRatings.length,
      };
    });
  }, [ratings]);

  // Study activity heatmap (last 12 weeks)
  const studyHeatmap = useMemo(() => {
    const today = new Date();
    const weeksToShow = 12;
    const startDate = subDays(today, weeksToShow * 7 - 1);
    const days = eachDayOfInterval({ start: startDate, end: today });

    // Count ratings per day
    const ratingCounts: Record<string, number> = {};
    ratings.forEach((r) => {
      const dateStr = getDateStr(r.timestamp);
      ratingCounts[dateStr] = (ratingCounts[dateStr] || 0) + 1;
    });

    // Get max for intensity scaling
    const maxCount = Math.max(...Object.values(ratingCounts), 1);

    // Group by week
    const weeks: { date: Date; count: number; intensity: number; dateStr: string }[][] = [];
    let currentWeek: { date: Date; count: number; intensity: number; dateStr: string }[] = [];

    days.forEach((day, index) => {
      const dateStr = getDateStr(day);
      const count = ratingCounts[dateStr] || 0;
      const intensity = count > 0 ? Math.ceil((count / maxCount) * 4) : 0;

      currentWeek.push({ date: day, count, intensity, dateStr });

      // Start new week on Sunday or last day
      if (day.getDay() === 6 || index === days.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    return { weeks, maxCount };
  }, [ratings]);

  // Weak topics breakdown
  const weakTopics = useMemo(() => {
    const topicStats: Record<string, { 
      name: string; 
      emoji: string;
      total: number; 
      weak: number; 
      avgRating: number;
      studied: number;
    }> = {};

    // Initialize with courses
    courses.forEach((course) => {
      topicStats[course.id] = {
        name: course.name,
        emoji: course.emoji,
        total: 0,
        weak: 0,
        avgRating: 0,
        studied: 0,
      };
    });

    // Add uncategorized
    topicStats["uncategorized"] = {
      name: "Uncategorized",
      emoji: "📁",
      total: 0,
      weak: 0,
      avgRating: 0,
      studied: 0,
    };

    // Calculate stats
    flashcards.forEach((card) => {
      const topicId = card.courseId || "uncategorized";
      if (!topicStats[topicId]) return;

      topicStats[topicId].total++;
      
      if (card.ratingCount > 0) {
        topicStats[topicId].studied++;
        topicStats[topicId].avgRating += card.averageRating || 0;
      }
      
      // Weak = rated 1-2 or never studied
      if (card.latestRating !== null && card.latestRating <= 2) {
        topicStats[topicId].weak++;
      }
    });

    // Finalize averages and sort by weakness
    return Object.entries(topicStats)
      .filter(([, stats]) => stats.total > 0)
      .map(([id, stats]) => ({
        id,
        ...stats,
        avgRating: stats.studied > 0 ? stats.avgRating / stats.studied : 0,
        weakPercentage: Math.round((stats.weak / stats.total) * 100),
        masteryPercentage: stats.studied > 0 
          ? Math.round(((stats.avgRating / stats.studied - 1) / 4) * 100)
          : 0,
      }))
      .sort((a, b) => b.weakPercentage - a.weakPercentage);
  }, [courses, flashcards]);

  // Study streak calculation
  const studyStreak = useMemo(() => {
    if (ratings.length === 0) return 0;

    const uniqueDates = [...new Set(
      ratings.map(r => getDateStr(r.timestamp))
    )].sort().reverse();

    if (uniqueDates.length === 0) return 0;

    const today = new Date();
    const todayStr = getDateStr(today);
    const yesterday = subDays(today, 1);
    const yesterdayStr = getDateStr(yesterday);

    if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
      return 0;
    }

    let streak = 0;
    let checkDate = parseISO(uniqueDates[0]);

    for (const dateStr of uniqueDates) {
      const expectedStr = getDateStr(checkDate);
      
      if (dateStr === expectedStr) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    return streak;
  }, [ratings]);

  // Heatmap color intensities
  const getHeatmapColor = (intensity: number) => {
    const colors = [
      "bg-[#EBE4D6]", // 0 - no activity
      "bg-[#C5E1A5]", // 1 - light
      "bg-[#9CCC65]", // 2 - medium-light
      "bg-[#7CB342]", // 3 - medium
      "bg-[#558B2F]", // 4 - dark
    ];
    return colors[intensity] || colors[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F1E8]">
        <p className="text-[#8B7355]">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const totalCards = flashcards.length;
  const studiedCards = flashcards.filter(f => f.ratingCount > 0).length;
  const masteredCards = flashcards.filter(f => f.mastered).length;

  return (
    <div className="min-h-screen bg-[#F5F1E8]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#D7CFC0]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard")}
              className="text-[#8B7355] hover:text-[#4A3426] hover:bg-[#EBE4D6] rounded-full"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-[#2C1810] font-serif">📊 Analytics</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Quick Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-white rounded-3xl shadow-soft border-0">
            <CardContent className="p-6 text-center">
              <p className="text-4xl font-bold text-[#2C1810] font-serif">{totalCards}</p>
              <p className="text-sm text-[#8B7355] mt-1">Total Cards</p>
            </CardContent>
          </Card>
          <Card className="bg-white rounded-3xl shadow-soft border-0">
            <CardContent className="p-6 text-center">
              <p className="text-4xl font-bold text-[#7CB342] font-serif">{studiedCards}</p>
              <p className="text-sm text-[#8B7355] mt-1">Cards Studied</p>
            </CardContent>
          </Card>
          <Card className="bg-white rounded-3xl shadow-soft border-0">
            <CardContent className="p-6 text-center">
              <p className="text-4xl font-bold text-[#FFB74D] font-serif">{masteredCards}</p>
              <p className="text-sm text-[#8B7355] mt-1">Mastered</p>
            </CardContent>
          </Card>
          <Card className="bg-white rounded-3xl shadow-soft border-0">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">🔥</span>
                <p className="text-4xl font-bold text-[#FF5722] font-serif">{studyStreak}</p>
              </div>
              <p className="text-sm text-[#8B7355] mt-1">Day Streak</p>
            </CardContent>
          </Card>
        </div>

        {/* Mastery Over Time Chart */}
        <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9]">
            <CardTitle className="text-[#2C1810] font-serif flex items-center gap-2">
              <span>📈</span>
              Mastery Over Time
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {ratings.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#8B7355]">
                <p>Study some flashcards to see your progress over time!</p>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={masteryOverTime} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBE4D6" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#8B7355"
                      tick={{ fill: "#8B7355", fontSize: 12 }}
                      tickLine={{ stroke: "#D7CFC0" }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      stroke="#8B7355"
                      tick={{ fill: "#8B7355", fontSize: 12 }}
                      tickLine={{ stroke: "#D7CFC0" }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFBF5",
                        border: "1px solid #D7CFC0",
                        borderRadius: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      formatter={(value: number | null) => [value !== null ? `${value}%` : "No data", "Mastery"]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="mastery"
                      stroke="#7CB342"
                      strokeWidth={3}
                      dot={{ fill: "#7CB342", strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: "#558B2F" }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Study Activity Heatmap */}
        <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB]">
            <CardTitle className="text-[#2C1810] font-serif flex items-center gap-2">
              <span>🗓️</span>
              Study Activity
              <span className="text-sm font-normal text-[#8B7355] ml-2">Last 12 weeks</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col gap-2">
              {/* Day labels */}
              <div className="flex gap-1 mb-1 ml-10">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
                  <span key={day} className="w-4 text-[10px] text-[#8B7355] text-center" style={{ display: i % 2 === 0 ? "block" : "none" }}>
                    {day.charAt(0)}
                  </span>
                ))}
              </div>
              
              {/* Heatmap grid */}
              <div className="flex gap-1">
                {/* Month labels would go here */}
                <div className="flex flex-col gap-1">
                  {studyHeatmap.weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex gap-1">
                      {/* Pad first week if needed */}
                      {weekIndex === 0 && week.length < 7 && (
                        [...Array(7 - week.length)].map((_, i) => (
                          <div key={`pad-${i}`} className="w-4 h-4" />
                        ))
                      )}
                      {week.map((day) => (
                        <div
                          key={day.dateStr}
                          className={`w-4 h-4 rounded-sm ${getHeatmapColor(day.intensity)} transition-colors hover:ring-2 hover:ring-[#7CB342] hover:ring-offset-1 cursor-pointer`}
                          title={`${format(day.date, "MMM d, yyyy")}: ${day.count} cards studied`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-2 mt-4 text-xs text-[#8B7355]">
                <span>Less</span>
                {[0, 1, 2, 3, 4].map((intensity) => (
                  <div
                    key={intensity}
                    className={`w-4 h-4 rounded-sm ${getHeatmapColor(intensity)}`}
                  />
                ))}
                <span>More</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weak Topics Breakdown */}
        <Card className="bg-white rounded-3xl shadow-soft border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-br from-[#FFEBEE] to-[#FFCDD2]">
            <CardTitle className="text-[#2C1810] font-serif flex items-center gap-2">
              <span>🎯</span>
              Topics Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {weakTopics.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-[#8B7355]">
                <p>Create courses and study flashcards to see topic breakdown!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {weakTopics.map((topic) => {
                  const masteryColor = topic.masteryPercentage >= 80 
                    ? "#7CB342" 
                    : topic.masteryPercentage >= 60 
                      ? "#FFB74D" 
                      : "#E57373";
                  
                  return (
                    <div key={topic.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{topic.emoji}</span>
                          <span className="font-medium text-[#2C1810]">{topic.name}</span>
                          <span className="text-xs text-[#8B7355]">({topic.total} cards)</span>
                        </div>
                        <div className="flex items-center gap-4">
                          {topic.weak > 0 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-[#FFEBEE] text-[#E57373] font-medium">
                              {topic.weak} weak
                            </span>
                          )}
                          <span 
                            className="text-lg font-bold font-serif"
                            style={{ color: masteryColor }}
                          >
                            {topic.masteryPercentage}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-[#EBE4D6] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${topic.masteryPercentage}%`,
                            backgroundColor: masteryColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


