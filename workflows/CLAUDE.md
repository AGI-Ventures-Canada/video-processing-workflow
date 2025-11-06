# Vercel Workflow Best Practices

Quick reference guide for working with Vercel Workflows in this project.

## Core Principles

### 1. Stream Writing Pattern

**❌ NEVER do this:**
```typescript
export async function myWorkflow() {
  "use workflow";

  const writable = getWritable();
  const writer = writable.getWriter(); // ERROR: Not supported
  await writer.write(...);
}
```

**✅ ALWAYS do this:**
```typescript
export async function myWorkflow() {
  "use workflow";

  const writable = getWritable();
  await writeProgress(writable, { data }); // Pass to step
}

async function writeProgress(writable: WritableStream, data: any) {
  "use step";

  const writer = writable.getWriter(); // OK in steps
  try {
    await writer.write(new TextEncoder().encode(JSON.stringify(data)));
  } finally {
    writer.releaseLock();
  }
}
```

### 2. Real-Time Streaming

**Key Insight:** Steps buffer their writes. To get real-time updates, make each write a separate step.

**❌ Single step with multiple writes (buffered):**
```typescript
async function process(writable: WritableStream) {
  "use step";
  const writer = writable.getWriter();

  await writer.write("step 1");
  await doWork1();
  await writer.write("step 2"); // Buffered until step completes
  await doWork2();
  await writer.write("step 3"); // Buffered until step completes

  writer.releaseLock();
}
```

**✅ Multiple steps (real-time):**
```typescript
export async function workflow() {
  "use workflow";
  const writable = getWritable();

  await writeProgress(writable, "step 1"); // Sent immediately
  await doWork1();
  await writeProgress(writable, "step 2"); // Sent immediately
  await doWork2();
  await writeProgress(writable, "step 3"); // Sent immediately
}
```

### 3. API Route Streaming

**✅ Use `.readable` property:**
```typescript
export async function POST(request: Request) {
  const run = await start(myWorkflow, [args]);

  const stream = run.readable; // Property, not .getReadable()

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### 4. Error Handling

**Always:**
- Send errors to the stream before throwing
- Clean up resources (blob storage, temp files)
- Re-throw to mark workflow as failed

```typescript
export async function workflow() {
  "use workflow";

  const writable = getWritable();
  let resource: string | null = null;

  try {
    resource = await createResource();
    const result = await processResource(resource);
    await writeProgress(writable, { type: "complete", result });
    return result;
  } catch (error) {
    await writeProgress(writable, {
      type: "error",
      message: error.message
    });

    if (resource) {
      await cleanupResource(resource);
    }

    throw error; // Re-throw for workflow failure
  }
}
```

### 5. Retry Safety

**Use `addRandomSuffix` for blob uploads:**
```typescript
async function uploadToBlob(buffer: Buffer, filename: string) {
  "use step";

  const blob = await put(filename, buffer, {
    access: "public",
    addRandomSuffix: true, // Prevents conflicts on retry
  });

  return blob.url;
}
```

## Common Patterns

### Progress Updates

```typescript
// Workflow orchestrates, steps write
export async function processVideo(buffer: Buffer) {
  "use workflow";
  const writable = getWritable();

  await writeProgress(writable, { percent: 0, step: "start" });
  const url = await uploadVideo(buffer);
  await writeProgress(writable, { percent: 25, step: "uploaded" });
  const frames = await extractFrames(url);
  await writeProgress(writable, { percent: 50, step: "extracted" });

  for (let i = 0; i < frames.length; i++) {
    await processFrame(frames[i]);
    const percent = 50 + (i / frames.length) * 50;
    await writeProgress(writable, { percent, frame: i });
  }

  await writeProgress(writable, { percent: 100, step: "complete" });
}
```

### File Processing

```typescript
async function extractFrames(videoUrl: string) {
  "use step";

  // Download and verify
  const response = await fetch(videoUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(tempPath, buffer);

  const stats = await stat(tempPath);
  if (stats.size !== buffer.length) {
    throw new Error("Download incomplete");
  }

  // Process
  await execAsync(`ffmpeg -i "${tempPath}" ...`);

  // Cleanup
  await unlink(tempPath);
}
```

## Debugging

### Enable Logging

```typescript
async function writeProgress(writable: WritableStream, data: any) {
  "use step";

  const message = JSON.stringify(data);
  console.log("[STREAM] Writing:", message); // Server logs

  const writer = writable.getWriter();
  try {
    await writer.write(new TextEncoder().encode(message + "\n"));
  } finally {
    writer.releaseLock();
  }
}
```

### Frontend Logging

```typescript
const reader = response.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  console.log("[CLIENT] Received chunk:", value.length, "bytes");

  const lines = buffer.split("\n");
  for (const line of lines) {
    console.log("[CLIENT] Parsed:", JSON.parse(line));
  }
}
```

## Quick Checklist

When creating a new workflow with streaming:

- [ ] Workflow gets `getWritable()`, never calls `.getWriter()`
- [ ] Created `writeProgress` step function
- [ ] Each progress update is a separate `await writeProgress()` call
- [ ] API route uses `run.readable` (property, not method)
- [ ] Added error handling with stream notification
- [ ] Resources cleaned up in catch block
- [ ] Blob uploads use `addRandomSuffix: true`
- [ ] File downloads are verified before processing

## Reference Examples

See these files for complete implementations:
- `workflows/process-video.ts` - Main workflow with streaming
- `app/api/upload-video/route.ts` - API route setup
- `components/upload-video-dialog.tsx` - Frontend stream consumption

## Additional Resources

- [Vercel Workflow Serialization Docs](https://vercel.com/docs/workflow/serialization)
- [AI SDK Workflow Example](https://github.com/vercel/ai/tree/main/examples/next-workflow)
- Main README.md - Detailed learnings and explanations
