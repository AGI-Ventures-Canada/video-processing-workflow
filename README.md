# Building Real-Time Video Moderation with Vercel Workflow

A production-ready video content moderation system that demonstrates the power (and quirks) of durable execution with real-time streaming.

## What This Is

This project processes videos frame-by-frame to detect inappropriate content, streaming live progress updates to the frontend. It's built to be both a functional application and an educational resource—every mistake, discovery, and solution is documented.

**Tech Stack:** Next.js 16, Vercel Workflow 4.0, Vercel Blob, FFmpeg, AI SDK 5, Gemini/OpenAI for content analysis.

## The Most Significant Learnings

### 1. Vercel Workflow's Streaming Constraints Are Non-Obvious

The biggest discovery: **workflow functions cannot call `.getWriter()` on streams**. Only step functions can. This isn't obvious from documentation, but it makes sense—workflows must be deterministic and replay-safe, and direct stream manipulation would break that guarantee.

The solution is architectural: workflow functions receive the `WritableStream` and pass it to step functions, which then write to it. This pattern took hours to discover but is now the foundation of the entire system.

### 2. Real-Time Streaming Requires Granular Steps

Early attempts buffered all progress updates within a single step function. The result? Everything arrived at once when the step completed, defeating the purpose of streaming.

The fix: **every progress update must be its own step**. After each step completes, the workflow suspends and the update reaches the client immediately. This means orchestrating dozens of tiny steps instead of a few large ones—counterintuitive, but necessary for real-time UX.

Critical constraint discovered: **steps cannot call other steps**. Nested steps cause silent hangs because workflows can only await step functions, not other workflow-level operations.

### 3. Multi-Provider AI Architecture for Resilience

The content moderation system supports both Gemini 2.5 Flash Lite and OpenAI GPT-5 through a clean factory pattern. Switch providers via environment variable. This abstraction proved essential when hitting rate limits or availability issues.

Content analysis uses structured output with Zod schemas via AI SDK's `streamObject`, eliminating prompt engineering guesswork. The system analyzes for 12+ content categories with confidence scoring (1-5 scale) and assigns ratings: Safe, 16+, or 18+.

### 4. Parallel Processing with Backpressure Control

Frame processing runs 10 concurrent AI requests using `p-limit`. This balances throughput with rate limit constraints—pure sequential processing was too slow; unlimited parallelism triggered rate errors.

Each frame extraction, AI analysis, and result storage happens in parallel, with progress updates streaming back individually. The user sees frames being analyzed in real-time.

### 5. Blob Storage Retry Safety Is Critical

Workflows retry failed steps automatically. Early versions crashed on retry because blob uploads failed with "already exists" errors.

The fix: `addRandomSuffix: true` on all blob uploads. Simple, but easy to miss.

Another trap: the `.readable` property streams correctly, but `.getReadable()` method does not. This subtle API difference cost debugging time.

### 6. FFmpeg Integration Requires File Verification

Downloaded video files occasionally failed with "moov atom not found" errors—FFmpeg tried reading before the file was fully written to disk.

Solution: verify file size after download matches buffer length before spawning FFmpeg. This defensive check prevented mysterious failures.

### 7. Frontend Stream Consumption Needs Careful Parsing

Server-Sent Events arrive as newline-delimited JSON chunks. The challenge: chunks can split mid-line. The solution requires buffering incomplete lines and parsing only complete ones, using a state machine pattern to track partial data.

Updates are typed by `type` field: `progress`, `frameProcessed`, `complete`, `error`. The frontend displays different UI for each, creating a rich real-time experience.

### 8. Error Handling Must Stream to Frontend

When workflows fail, the error must be written to the stream so the frontend can show meaningful messages. Otherwise, the upload dialog sits in loading state indefinitely.

Cleanup is critical: delete uploaded video blobs on error to avoid storage costs. Delete original videos after processing completes, keep only flagged screenshots.

### 9. LocalStorage as Database Is Surprisingly Effective

No traditional database—everything lives in browser localStorage. For a demo, this provides instant persistence without infrastructure complexity. Data models are simple: `FlaggedVideo` and `FlaggedFrame` with all metadata.

The grid refreshes on mount to show newly processed videos. Status can be updated to "approved" or "removed" via the detail modal.

### 10. Production-Ready Error Handling Throughout

Timeouts on AI requests (2 minutes), graceful fallbacks, blob cleanup on failures, file verification, retry-safe uploads. Every failure mode discovered during development is now handled.

The workflow documents common errors and solutions in dedicated CLAUDE.md files—both at project root and in the workflows directory. These serve as living documentation of lessons learned.

## Architecture Highlights

Videos upload via drag-and-drop to a Next.js API route that starts the Vercel Workflow and returns a `ReadableStream`. The frontend consumes this stream, parsing progress updates and rendering them in a custom Queue component that visualizes workflow stages.

The workflow orchestrates: upload to Blob → download to temp file → FFmpeg frame extraction (1 frame per 5 seconds) → parallel AI analysis → structured results → cleanup → stream completion.

Every step is separate. Every progress update is its own step. This granularity enables true real-time streaming.

## Why This Matters

This project documents what you learn the hard way: the gap between documentation and production. Vercel Workflow is powerful, but its constraints around streaming, determinism, and step granularity aren't intuitive.

The codebase reads like a blog post crossed with production code—it teaches while it demonstrates. Every commented constraint, every documented gotcha, exists because we hit it.

If you're building durable execution workflows with real-time streaming, this project shows the patterns that work and the pitfalls to avoid.

## Key Components

**Upload Dialog:** Sophisticated drag-and-drop UI with custom Queue visualization showing workflow stages (uploading, extracting, analyzing). Progress bar updates in real-time as frames are processed.

**Video Grid:** Card-based gallery displaying all processed videos with severity badges (high/medium/low), rating badges (16+/18+), and flag counts.

**Detail Modal:** Full inspection view showing all flagged frames with screenshots, AI confidence scores, detailed reasoning per category, and action buttons.

**Content Moderation Engine:** Parallel processing with structured AI output. Categories include: cursing, violence, sexual content, nudity, drug use, gore, disturbing themes. Each has confidence scores and natural language explanations.

## What Changed During Development

Originally attempted single-step buffering—failed. Discovered the nested steps antipattern—fixed. Hit blob retry errors—resolved with random suffixes. Encountered FFmpeg file read failures—added verification. Found `.getReadable()` didn't stream—switched to `.readable` property.

The AI provider abstraction was added after experiencing Gemini rate limits. LocalStorage replaced an initial database design for simplicity. The Queue component was custom-built after shadcn/ui components didn't fit the workflow visualization needs.

## Running This Yourself

Install FFmpeg, configure Vercel Blob storage, set environment variables for AI providers (Gemini or OpenAI), run `pnpm dev`. Full instructions in original README.

Deploy to Vercel for automatic Workflow runtime support—no additional configuration needed.

## Future Directions

The foundation is production-ready, but opportunities remain: webhook patterns for long-running processes, database persistence for scale, batch processing for multiple videos, user authentication, video preview in results.

The current implementation proves the core pattern: durable execution with real-time streaming for computationally intensive tasks.

## References

Built using Vercel Workflow 4.0, AI SDK 5, Next.js 16 App Router. Comprehensive documentation in `/workflows/CLAUDE.md` covers every workflow pattern and antipattern discovered during development.

---

This isn't just a demo. It's documentation of the journey from "this should work" to "this actually works in production." All the mistakes included.
