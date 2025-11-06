# Video Processing Workflow: A Deep Dive into Vercel Workflow Streaming

A real-time video content moderation system built with Next.js, Vercel Workflow, Vercel Blob, and FFmpeg.

## Overview

This project demonstrates how to build a production-ready video processing pipeline using Vercel Workflow's durable execution and real-time streaming capabilities. Users can upload videos, which are automatically analyzed frame-by-frame for inappropriate content, with live progress updates streamed to the frontend.

**Key Technologies:**
- **Vercel Workflow** - Durable execution with built-in retry and state management
- **Vercel Blob** - Temporary video and screenshot storage
- **FFmpeg** - Frame extraction from videos
- **AI SDK 5** - Streaming utilities and transport layer
- **Next.js 16** - App Router with Server Actions
- **shadcn/ui** - UI components

## Architecture

```
┌─────────────┐
│   Upload    │
│   Dialog    │
└──────┬──────┘
       │ FormData
       ▼
┌─────────────────────────────────┐
│  API Route                      │
│  /api/upload-video              │
│  - Starts workflow              │
│  - Returns readable stream      │
└────────┬────────────────────────┘
         │ ReadableStream
         ▼
┌─────────────────────────────────┐
│  Frontend                       │
│  - Reads stream chunks          │
│  - Parses JSON updates          │
│  - Updates progress UI          │
└─────────────────────────────────┘

         Workflow Execution
         ==================
┌─────────────────────────────────┐
│  Workflow Function              │
│  - Gets WritableStream          │
│  - Calls steps                  │
│  - Passes stream to steps       │
└────────┬────────────────────────┘
         │
         ├─► writeProgress (step)
         ├─► uploadVideoToBlob (step)
         ├─► writeProgress (step)
         ├─► extractFrames (step)
         ├─► writeProgress (step)
         ├─► processOneFrame (step) ×N
         ├─► writeProgress (step) ×N
         ├─► deleteVideoBlob (step)
         └─► writeProgress (step)
```

## The Journey: Key Learnings

### 1. Understanding Workflow Streaming Constraints

**The Problem We Hit:**
Initially, we tried to call `.getWriter()` directly in the workflow function:

```typescript
// ❌ THIS DOESN'T WORK
export async function processVideo() {
  "use workflow";

  const writable = getWritable();
  const writer = writable.getWriter(); // ERROR: Not supported in workflow functions
  await writer.write(...);
}
```

**Error:**
```
Error: Not supported in workflow functions
    at WritableStream.getWriter
```

**Why?** Workflow functions must be deterministic and replay-safe. Direct stream manipulation would break this guarantee.

**The Solution:**
Pass the `WritableStream` to step functions, which CAN call `.getWriter()`:

```typescript
// ✅ THIS WORKS
export async function processVideo() {
  "use workflow";

  const writable = getWritable();
  await writeProgress(writable, { step: "started" }); // Pass to step
}

async function writeProgress(writable: WritableStream, data: any) {
  "use step";

  const writer = writable.getWriter(); // OK in step functions!
  try {
    await writer.write(new TextEncoder().encode(JSON.stringify(data)));
  } finally {
    writer.releaseLock();
  }
}
```

### 2. Single Step vs. Multiple Steps for Real-Time Updates

**First Attempt: Single Big Step**

We initially tried to put all logic in one step:

```typescript
async function processVideoWithStreaming(writable, buffer, filename) {
  "use step";

  const writer = writable.getWriter();

  await writer.write("uploading...");
  await uploadVideo();
  await writer.write("extracting...");
  await extractFrames();
  await writer.write("processing...");
  await processFrames();

  writer.releaseLock();
}
```

**The Problem:**
- Step ran for 2-3 seconds
- ALL writes were buffered until step completed
- Frontend received everything at once at the end
- No real-time progress!

**The Solution: Multiple Small Steps**

Break work into separate steps, write progress between them:

```typescript
export async function processVideo(buffer, filename) {
  "use workflow";

  const writable = getWritable();

  await writeProgress(writable, { step: "started" });     // Step 1: Write
  const url = await uploadVideo(buffer, filename);         // Step 2: Upload
  await writeProgress(writable, { step: "uploaded" });    // Step 3: Write
  const frames = await extractFrames(url);                 // Step 4: Extract
  await writeProgress(writable, { step: "extracted" });   // Step 5: Write

  for (let i = 0; i < frames.length; i++) {
    await processFrame(frames[i]);                         // Step N: Process
    await writeProgress(writable, { frame: i });           // Step N+1: Write
  }
}
```

**Result:** Each `await writeProgress()` call is a separate step. After each step completes, the workflow suspends and the write reaches the client immediately!

### 3. API Route Streaming: `.readable` vs `.getReadable()`

**Another Gotcha:**

```typescript
// ❌ DOESN'T STREAM PROPERLY
const stream = workflowRun.getReadable();

// ✅ CORRECT - USE PROPERTY, NOT METHOD
const stream = workflowRun.readable;
```

Following the AI SDK example pattern:

```typescript
export async function POST(request: Request) {
  const workflowRun = await start(processVideoUpload, [buffer, filename]);

  const stream = workflowRun.readable; // Property, not method!

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### 4. Blob Storage and Retry Safety

**Challenge:** When workflow steps retry, blob uploads would fail with:

```
Error: This blob already exists, use `allowOverwrite: true`
```

**Solution:** Use `addRandomSuffix: true`:

```typescript
async function uploadVideoToBlob(buffer: Buffer, filename: string) {
  "use step";

  const blob = await put(filename, buffer, {
    access: "public",
    contentType: "video/mp4",
    addRandomSuffix: true, // ✅ Prevents conflicts on retry
  });

  return blob.url;
}
```

### 5. FFmpeg Integration - The "moov atom not found" Error

**Problem:** FFmpeg couldn't read the downloaded video:

```
[mov,mp4,m4a,3gp,3g2,mj2 @ 0x70f038000] moov atom not found
Error opening input file
```

**Root Cause:** File wasn't fully written/synced before FFmpeg tried to read it.

**Solution:** Verify file after download:

```typescript
async function extractFrames(videoUrl: string, filename: string) {
  "use step";

  // Download video
  const response = await fetch(videoUrl);
  const videoBuffer = Buffer.from(await response.arrayBuffer());
  await writeFile(videoPath, videoBuffer);

  // Verify file was written correctly
  const stats = await stat(videoPath);
  if (stats.size !== videoBuffer.length) {
    throw new Error(`File size mismatch: ${stats.size} vs ${videoBuffer.length}`);
  }

  // Now FFmpeg can read it
  await execAsync(`ffmpeg -i "${videoPath}" -vf fps=1/5 "${outputPattern}"`);
}
```

### 6. Frontend Stream Consumption

**Pattern:**

```typescript
const response = await fetch("/api/upload-video", {
  method: "POST",
  body: formData,
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });

  // Process complete lines
  const lines = buffer.split("\n");
  buffer = lines.pop() || ""; // Keep incomplete line

  for (const line of lines) {
    if (!line.trim()) continue;
    const update = JSON.parse(line);

    // Update UI based on update.type
    if (update.type === "progress") {
      setProgress(update.percent);
    } else if (update.type === "complete") {
      setResult(update.result);
    }
  }
}
```

### 7. Error Handling in Workflows

**Best Practice:**

```typescript
export async function processVideo(buffer, filename) {
  "use workflow";

  const writable = getWritable();
  let videoUrl: string | null = null;

  try {
    videoUrl = await uploadStep(buffer, filename);
    const frames = await extractStep(videoUrl);
    const incidents = await processStep(frames);

    await writeProgress(writable, {
      type: "complete",
      result: { incidents }
    });

    return { incidents };
  } catch (error) {
    // Send error to client
    await writeProgress(writable, {
      type: "error",
      message: error.message,
    });

    // Cleanup resources
    if (videoUrl) {
      await deleteBlob(videoUrl);
    }

    throw error; // Re-throw to mark workflow as failed
  }
}
```

## Key Patterns & Best Practices

### ✅ DO

1. **Pass streams to steps** - Workflow gets stream, steps write to it
2. **One write per step** - Each progress update should be a separate step call
3. **Use `.readable` property** - Not `.getReadable()` method in API routes
4. **Add random suffixes to blobs** - Prevents retry conflicts
5. **Verify file downloads** - Check file size before processing
6. **Clean up resources** - Delete temp files and blobs, even on error
7. **Send errors to stream** - Let frontend know what went wrong

### ❌ DON'T

1. **Don't call `.getWriter()` in workflows** - Only in step functions
2. **Don't write multiple times in one step** - Won't stream in real-time
3. **Don't forget error handling** - Workflows can retry, clean up resources
4. **Don't ignore file validation** - Verify downloads completed successfully

## Project Structure

```
video-processing-workflow/
├── app/
│   ├── api/
│   │   └── upload-video/
│   │       └── route.ts         # API route, returns stream
│   ├── layout.tsx
│   └── page.tsx                 # Main page with video grid
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── topbar.tsx              # Upload button
│   ├── upload-video-dialog.tsx # Upload UI with progress
│   └── video-moderation-grid.tsx
├── workflows/
│   ├── process-video.ts        # Main workflow logic
│   └── CLAUDE.md               # Workflow best practices
└── CLAUDE.md                   # Project instructions
```

## Running Locally

```bash
# Install dependencies
pnpm install

# Set up environment variables
echo "BLOB_READ_WRITE_TOKEN=your_token" > .env.local

# Run development server
pnpm dev
```

**Requirements:**
- FFmpeg installed (`brew install ffmpeg` on macOS)
- Vercel Blob storage configured
- Node.js 18+

## Deployment

Deploy to Vercel for automatic Workflow support:

```bash
vercel deploy
```

Workflow runtime is automatically configured on Vercel - no additional setup needed!

## Future Enhancements

- [ ] Use AI SDK for actual content moderation (replace mock)
- [ ] Add webhook pattern for long-running processes
- [ ] Implement video preview in results
- [ ] Add batch processing for multiple videos
- [ ] Store moderation results in database
- [ ] Add authentication and user management

## References

- [Vercel Workflow Documentation](https://vercel.com/docs/workflow)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Vercel Blob Documentation](https://vercel.com/docs/storage/vercel-blob)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

---

Built with insights from building a real-world video processing pipeline. All the mistakes, learnings, and solutions documented for the next developer.
