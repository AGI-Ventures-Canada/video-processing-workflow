import { put, del } from "@vercel/blob";
import { getWritable } from "workflow";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile, stat } from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export async function processVideoUpload(videoBuffer: Buffer, filename: string) {
  "use workflow";

  console.log(`Starting video processing workflow for: ${filename}`);

  // Get writable stream - pass to steps for writing
  const writable = getWritable();

  let videoUrl: string | null = null;

  try {
    await writeProgress(writable, {
      type: "progress",
      step: "started",
      message: "Starting video processing",
      percent: 5,
    });

    // Step 1: Upload video to Vercel Blob
    videoUrl = await uploadVideoToBlob(videoBuffer, filename);
    console.log(`Video uploaded to blob: ${videoUrl}`);
    await writeProgress(writable, {
      type: "progress",
      step: "uploaded",
      message: "Video uploaded to storage",
      percent: 20,
    });

    // Step 2: Extract frames using ffmpeg
    const frames = await extractFrames(videoUrl, filename);
    console.log(`Extracted ${frames.length} frames from video`);
    await writeProgress(writable, {
      type: "progress",
      step: "extracted",
      message: `Extracted ${frames.length} frames`,
      totalFrames: frames.length,
      percent: 40,
    });

    // Step 3: Process each frame for moderation (each frame is a separate step)
    const incidents = [];
    const totalFrames = frames.length;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const incident = await processOneFrame(frame);

      if (incident) {
        incidents.push(incident);
      }

      // Write progress update for each frame
      const percent = 40 + Math.floor(((i + 1) / totalFrames) * 50);
      await writeProgress(writable, {
        type: "frameProcessed",
        message: `Processing frame ${i + 1} of ${totalFrames}`,
        current: i + 1,
        total: totalFrames,
        percent,
      });
    }

    console.log(`Found ${incidents.length} incidents in video`);

    await writeProgress(writable, {
      type: "progress",
      step: "cleanup",
      message: "Cleaning up temporary files",
      percent: 95,
    });

    // Step 4: Delete the original video from blob
    if (videoUrl) {
      await deleteVideoBlob(videoUrl);
      console.log(`Deleted original video from blob`);
    }

    const result = {
      incidents,
      totalFrames: frames.length,
      processedAt: new Date().toISOString(),
    };

    await writeProgress(writable, {
      type: "complete",
      message: "Processing complete",
      percent: 100,
      result,
    });

    return result;
  } catch (error) {
    console.error("Error in video processing:", error);

    // Send error to client
    await writeProgress(writable, {
      type: "error",
      message: error instanceof Error ? error.message : "Processing failed",
      error: error instanceof Error ? error.message : String(error),
    });

    // Cleanup: delete uploaded video if it exists
    if (videoUrl) {
      try {
        await deleteVideoBlob(videoUrl);
        console.log(`Cleaned up blob after error: ${videoUrl}`);
      } catch (cleanupError) {
        console.error("Error cleaning up blob:", cleanupError);
      }
    }

    throw error; // Re-throw to mark workflow as failed
  }
}

async function writeProgress(writable: WritableStream, data: any) {
  "use step";

  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  try {
    const message = JSON.stringify(data) + "\n";
    console.log("[STREAM] Writing:", message.trim());
    await writer.write(encoder.encode(message));
  } finally {
    writer.releaseLock();
  }
}

async function processOneFrame(frame: {
  buffer: Buffer;
  timestamp: number;
  filename: string;
}) {
  "use step";

  const moderationResult = await moderateFrame(frame);

  if (moderationResult.isFlagged) {
    const screenshotUrl = await uploadScreenshotToBlob(
      frame.buffer,
      frame.filename
    );

    return {
      timestamp: frame.timestamp,
      confidence: moderationResult.confidence,
      categories: moderationResult.categories,
      screenshotUrl,
    };
  }

  return null;
}

async function uploadVideoToBlob(videoBuffer: Buffer, filename: string) {
  "use step";

  const blob = await put(filename, videoBuffer, {
    access: "public",
    contentType: "video/mp4",
    addRandomSuffix: true, // Prevent overwrite errors on retry
  });

  return blob.url;
}

async function extractFrames(videoUrl: string, filename: string) {
  "use step";

  const tmpDir = os.tmpdir();
  const videoId = Date.now();
  const videoPath = path.join(tmpDir, `${videoId}-${filename}`);
  const framesDir = path.join(tmpDir, `frames-${videoId}`);

  try {
    // Download video from blob URL
    const response = await fetch(videoUrl);

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);

    // Write file with proper error handling
    await writeFile(videoPath, videoBuffer);

    // Verify file was written correctly
    const stats = await stat(videoPath);
    console.log(`Video downloaded: ${stats.size} bytes (expected: ${videoBuffer.length})`);

    if (stats.size !== videoBuffer.length) {
      throw new Error(`File size mismatch: wrote ${stats.size} bytes, expected ${videoBuffer.length}`);
    }

    // Create frames directory
    await execAsync(`mkdir -p "${framesDir}"`);

    // Extract frames using ffmpeg (1 frame every 5 seconds)
    const outputPattern = path.join(framesDir, "frame-%04d.jpg");
    await execAsync(
      `ffmpeg -i "${videoPath}" -vf fps=1/5 "${outputPattern}"`
    );

    // Get list of frame files
    const { stdout } = await execAsync(`ls "${framesDir}"`);
    const frameFiles = stdout.trim().split("\n").filter(Boolean);

    // Read frame data with timestamps
    const frames = await Promise.all(
      frameFiles.map(async (frameFile, index) => {
        const framePath = path.join(framesDir, frameFile);
        const buffer = await readFile(framePath);
        const timestamp = index * 5; // seconds

        // Clean up frame file
        await unlink(framePath);

        return {
          buffer,
          timestamp,
          filename: frameFile,
        };
      })
    );

    // Clean up video file and frames directory
    await unlink(videoPath);
    await execAsync(`rmdir "${framesDir}"`);

    return frames;
  } catch (error) {
    console.error("Error extracting frames:", error);
    throw error;
  }
}

async function moderateFrame(frame: {
  buffer: Buffer;
  timestamp: number;
  filename: string;
}) {
  "use step";

  // Mock moderation API - replace with actual moderation service
  // For now, randomly flag ~20% of frames for demonstration
  const isFlagged = Math.random() < 0.2;

  if (isFlagged) {
    return {
      isFlagged: true,
      confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
      categories: ["adult", "violence", "gore"][
        Math.floor(Math.random() * 3)
      ],
    };
  }

  return {
    isFlagged: false,
    confidence: 0,
    categories: null,
  };
}

async function uploadScreenshotToBlob(buffer: Buffer, filename: string) {
  "use step";

  const screenshotName = `screenshots/${filename}`;

  const blob = await put(screenshotName, buffer, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true, // Prevent overwrite errors on retry
  });

  return blob.url;
}

async function deleteVideoBlob(videoUrl: string) {
  "use step";

  try {
    await del(videoUrl);
    console.log(`Successfully deleted video from blob: ${videoUrl}`);
  } catch (error) {
    console.error("Error deleting video from blob:", error);
    // Don't throw - cleanup failure shouldn't fail the workflow
  }
}
