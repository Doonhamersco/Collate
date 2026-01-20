# Collate - AI Study Assistant

Upload PDFs and generate flashcards with AI to study smarter.

## Features

- 📄 Upload PDF documents
- 🤖 AI-powered flashcard generation (Claude)
- 🎴 Interactive flashcard study mode
- 🔐 Firebase authentication

## Quick Start

### 1. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable **Authentication**:
   - Go to Authentication → Sign-in method
   - Enable **Email/Password**
4. Enable **Firestore Database**:
   - Go to Firestore Database → Create database
   - Start in **test mode** (for development)
5. Enable **Storage**:
   - Go to Storage → Get started
   - Start in **test mode** (for development)
6. Get your config:
   - Go to Project Settings → General → Your apps
   - Click "Add app" → Web
   - Copy the config values

### 2. Set up Anthropic API

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Copy the key

### 3. Configure Environment

Create a `.env.local` file in the project root:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Anthropic API Key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 4. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Sign up** with email/password
2. **Upload** a PDF document
3. Wait for text extraction to complete
4. Click **Generate** to create flashcards
5. Click **Study** to review flashcards

## Firebase Security Rules (Production)

For production, update your Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /files/{fileId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /flashcards/{flashcardId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

And Storage rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/files/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth & Database**: Firebase
- **AI**: Anthropic Claude
- **PDF Parsing**: pdf-parse

## MVP Limitations

This is an MVP with intentional simplifications:

- PDF only (no DOCX/PPTX)
- No text chunking (full text sent to AI)
- No storage quotas
- Synchronous processing

These can be enhanced in future iterations.
