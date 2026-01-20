import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface FlashcardRequest {
  userId: string;
  fileId: string;
  fileName: string;
  courseId: string | null;
  courseName: string | null;
  text: string;
}

interface GeneratedFlashcard {
  question: string;
  answer: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FlashcardRequest = await request.json();
    const { userId, fileId, fileName, courseId, courseName, text } = body;

    if (!userId || !fileId || !fileName || !text) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Truncate text if too long (Claude has context limits)
    // For MVP, limit to ~100k characters (~25k tokens)
    const maxLength = 100000;
    const truncatedText = text.length > maxLength 
      ? text.substring(0, maxLength) + "\n\n[Text truncated due to length...]"
      : text;

    // Generate flashcards using Claude
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are an expert educator creating study flashcards. Based on the following text from a study document, create 10-15 high-quality flashcards that help students learn the key concepts.

Guidelines:
- Focus on the most important concepts, definitions, and facts
- Questions should be clear and specific
- Answers should be concise but complete
- Avoid yes/no questions
- Mix different types: definitions, explanations, applications
- Make sure flashcards are self-contained (don't reference "the text" or "the document")

Return your response as a JSON array of objects with "question" and "answer" fields. Only return the JSON array, no other text.

Example format:
[
  {"question": "What is photosynthesis?", "answer": "The process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen."},
  {"question": "What are the two stages of photosynthesis?", "answer": "The light-dependent reactions and the Calvin cycle (light-independent reactions)."}
]

Document text:
${truncatedText}`,
        },
      ],
    });

    // Parse the response
    const responseText = message.content[0].type === "text" 
      ? message.content[0].text 
      : "";

    // Extract JSON from the response (handle potential markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let flashcards: GeneratedFlashcard[];
    try {
      flashcards = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Claude response:", responseText);
      return NextResponse.json(
        { message: "Failed to parse flashcard response" },
        { status: 500 }
      );
    }

    // Validate the flashcards
    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      return NextResponse.json(
        { message: "No flashcards generated" },
        { status: 500 }
      );
    }

    // Return flashcards for client-side storage
    // (In MVP, client will write to Firestore)
    return NextResponse.json({
      flashcards: flashcards.map((fc) => ({
        question: fc.question,
        answer: fc.answer,
        fileId,
        fileName,
        courseId: courseId || null,
        courseName: courseName || null,
        // Rating fields (initialized)
        latestRating: null,
        ratingCount: 0,
        consecutiveFives: 0,
        averageRating: null,
        mastered: false,
        masteredAt: null,
        nextReviewAt: null,
      })),
      count: flashcards.length,
    });
  } catch (error) {
    console.error("Flashcard generation error:", error);
    
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          { message: "Invalid Anthropic API key. Please check your configuration." },
          { status: 500 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          { message: "Rate limit exceeded. Please try again later." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { message: "Failed to generate flashcards" },
      { status: 500 }
    );
  }
}

