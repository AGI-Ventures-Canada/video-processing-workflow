// No top-level imports of Node.js modules
// Dynamic imports are used inside the step function to avoid workflow serialization issues

export async function extractFrames(videoUrl: string, filename: string) {
  "use step";

  // Dynamic imports - only loaded at runtime, not during workflow serialization
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const { writeFile, unlink, readFile, stat } = await import("fs/promises");
  const path = await import("path");
  const os = await import("os");
  const { uploadFrameToBlob } = await import("./blob-storage");

  const execAsync = promisify(exec);

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
    let videoBuffer = Buffer.from(arrayBuffer);

    // Write file with proper error handling
    await writeFile(videoPath, Buffer.from(videoBuffer));

    // Verify file was written correctly
    const stats = await stat(videoPath);
    console.log(`Video downloaded: ${stats.size} bytes (expected: ${videoBuffer.length})`);

    if (stats.size !== videoBuffer.length) {
      throw new Error(`File size mismatch: wrote ${stats.size} bytes, expected ${videoBuffer.length}`);
    }

    // Clear video buffer from memory after writing to disk
    videoBuffer = null as any;

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

    // Read frames one at a time, upload to blob, and return URLs instead of buffers
    const frames = [];
    for (let index = 0; index < frameFiles.length; index++) {
      const frameFile = frameFiles[index];
      const framePath = path.join(framesDir, frameFile);

      // Read frame buffer
      const buffer = await readFile(framePath);
      const timestamp = index * 5; // seconds

      // Upload frame to blob storage immediately (reduces memory usage)
      const frameUrl = await uploadFrameToBlob(buffer, frameFile);

      // Clean up frame file from disk
      await unlink(framePath);

      frames.push({
        url: frameUrl,  // Store URL instead of buffer
        timestamp,
        filename: frameFile,
      });
    }

    // Clean up video file and frames directory
    await unlink(videoPath);
    await execAsync(`rmdir "${framesDir}"`);

    return frames;
  } catch (error) {
    console.error("Error extracting frames:", error);
    throw error;
  }
}
