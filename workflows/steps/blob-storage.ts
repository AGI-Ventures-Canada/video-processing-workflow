// No top-level imports of Node.js modules
// Dynamic imports are used inside the step functions to avoid workflow serialization issues

export async function uploadVideoToBlob(videoBuffer: Buffer, filename: string) {
  "use step";

  // Dynamic import - only loaded at runtime, not during workflow serialization
  const { put } = await import("@vercel/blob");

  const blob = await put(filename, videoBuffer, {
    access: "public",
    contentType: "video/mp4",
    addRandomSuffix: true, // Prevent overwrite errors on retry
  });

  return blob.url;
}

export async function uploadScreenshotToBlob(buffer: Buffer, filename: string) {
  "use step";

  // Dynamic import - only loaded at runtime, not during workflow serialization
  const { put } = await import("@vercel/blob");

  const screenshotName = `screenshots/${filename}`;

  const blob = await put(screenshotName, buffer, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true, // Prevent overwrite errors on retry
  });

  return blob.url;
}

export async function uploadFrameToBlob(buffer: Buffer, filename: string) {
  // Note: Not a step - called from within extractFrames step
  // Uploads individual frame to blob storage

  // Dynamic import - only loaded at runtime, not during workflow serialization
  const { put } = await import("@vercel/blob");

  const frameName = `frames/${filename}`;

  const blob = await put(frameName, buffer, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true,
  });

  return blob.url;
}

export async function deleteVideoBlob(videoUrl: string) {
  "use step";

  // Dynamic import - only loaded at runtime, not during workflow serialization
  const { del } = await import("@vercel/blob");

  try {
    await del(videoUrl);
    console.log(`Successfully deleted video from blob: ${videoUrl}`);
  } catch (error) {
    console.error("Error deleting video from blob:", error);
    // Don't throw - cleanup failure shouldn't fail the workflow
  }
}
