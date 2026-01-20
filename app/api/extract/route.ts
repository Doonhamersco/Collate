import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { OfficeParser } from "officeparser";

// Import pdf-parse internals directly to bypass the test file loading
const Pdf = require("pdf-parse/lib/pdf-parse.js");

const SUPPORTED_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
} as const;

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount?: number }> {
  const pdfData = await Pdf(buffer);
  return {
    text: pdfData.text,
    pageCount: pdfData.numpages,
  };
}

async function extractDocxText(buffer: Buffer): Promise<{ text: string }> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value };
}

async function extractPptxText(buffer: Buffer): Promise<{ text: string }> {
  const ast = await OfficeParser.parseOffice(buffer);
  return { text: ast.toText() };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const fileType = SUPPORTED_TYPES[file.type as keyof typeof SUPPORTED_TYPES];
    if (!fileType) {
      return NextResponse.json(
        { message: `Unsupported file type: ${file.type}. Supported: PDF, DOCX, PPTX` },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text = "";
    let pageCount: number | undefined;

    // Extract text based on file type
    switch (fileType) {
      case "pdf": {
        const result = await extractPdfText(buffer);
        text = result.text;
        pageCount = result.pageCount;
        break;
      }
      case "docx": {
        const result = await extractDocxText(buffer);
        text = result.text;
        break;
      }
      case "pptx": {
        const result = await extractPptxText(buffer);
        text = result.text;
        break;
      }
    }

    // Clean up the extracted text
    text = text
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    if (!text || text.length < 50) {
      return NextResponse.json(
        { 
          message: "Could not extract enough text from the file. It may be scanned or image-based.",
          text: text || ""
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      text,
      pageCount,
    });
  } catch (error) {
    console.error("Text extraction error:", error);
    return NextResponse.json(
      { message: "Failed to extract text from file" },
      { status: 500 }
    );
  }
}
