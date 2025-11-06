import type { FlaggedVideo, FlaggedFrame, CategoryReason } from "@/components/video-moderation-grid";
import type { ContentAnalysis } from "@/ai/ocr/types";

const STORAGE_KEY = "flagged_videos";

/**
 * Generate a unique video ID
 */
export function generateVideoId(): string {
  return `vid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique frame ID
 */
export function generateFrameId(): string {
  return `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format timestamp in seconds to MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Calculate severity based on incidents
 */
export function calculateSeverity(
  incidents: Array<{ confidence: number; rating?: string; categories?: string }>
): "high" | "medium" | "low" {
  if (incidents.length === 0) return "low";

  const highConfidenceCount = incidents.filter((i) => i.confidence > 0.9).length;
  const eighteenPlusCount = incidents.filter((i) => i.rating === "18+").length;

  if (eighteenPlusCount >= 2 || highConfidenceCount >= 5) return "high";
  if (incidents.length >= 3 || highConfidenceCount >= 2) return "medium";
  return "low";
}

/**
 * Calculate overall video rating based on highest frame rating
 */
export function calculateVideoRating(
  incidents: Array<{ rating?: string }>
): "safe" | "16+" | "18+" {
  if (incidents.length === 0) return "safe";

  // If any frame is rated 18+, the entire video is 18+
  const hasEighteenPlus = incidents.some((i) => i.rating === "18+");
  if (hasEighteenPlus) return "18+";

  // If any frame is rated 16+, the entire video is 16+
  const hasSixteenPlus = incidents.some((i) => i.rating === "16+");
  if (hasSixteenPlus) return "16+";

  // Otherwise, the video is safe
  return "safe";
}

/**
 * Save a processed video to localStorage
 */
export function saveVideo(video: FlaggedVideo): void {
  const videos = getVideos();
  const existingIndex = videos.findIndex((v) => v.id === video.id);

  if (existingIndex >= 0) {
    // Update existing video
    videos[existingIndex] = video;
  } else {
    // Add new video
    videos.unshift(video); // Add to beginning (newest first)
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
}

/**
 * Get all videos from localStorage
 */
export function getVideos(): FlaggedVideo[] {
  if (typeof window === "undefined") return []; // SSR safety

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as FlaggedVideo[];
  } catch (error) {
    console.error("Error parsing videos from localStorage:", error);
    return [];
  }
}

/**
 * Get a single video by ID
 */
export function getVideo(id: string): FlaggedVideo | null {
  const videos = getVideos();
  return videos.find((v) => v.id === id) || null;
}

/**
 * Update video status
 */
export function updateVideoStatus(
  id: string,
  status: "flagged" | "approved" | "removed"
): boolean {
  const videos = getVideos();
  const video = videos.find((v) => v.id === id);

  if (!video) return false;

  video.status = status;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  return true;
}

/**
 * Delete a video
 */
export function deleteVideo(id: string): boolean {
  const videos = getVideos();
  const filtered = videos.filter((v) => v.id !== id);

  if (filtered.length === videos.length) return false; // Video not found

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

/**
 * Clear all videos (for testing)
 */
export function clearAllVideos(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Extract category reasons from ContentAnalysis
 */
function extractCategoryReasons(analysis?: ContentAnalysis): CategoryReason[] {
  if (!analysis) return [];

  const reasons: CategoryReason[] = [];

  // Map of category keys to display names
  const categoryNames: Record<string, string> = {
    cursing: "Cursing",
    moderate_violence: "Moderate Violence",
    strong_language: "Strong Language",
    mild_sexual_content: "Mild Sexual Content",
    nudity: "Nudity",
    drug_use: "Drug Use",
    rape: "Sexual Assault",
    murder: "Murder",
    stabbing: "Stabbing",
    gore: "Gore",
    extreme_profanity: "Extreme Profanity",
    disturbing_themes: "Disturbing Themes",
  };

  // Extract 16+ categories
  Object.entries(analysis.sixteenPlus).forEach(([key, value]) => {
    if (value.detected) {
      reasons.push({
        category: categoryNames[key] || key,
        detected: value.detected,
        confidence: value.confidence,
        reason: value.reason,
      });
    }
  });

  // Extract 18+ categories
  Object.entries(analysis.eighteenPlus).forEach(([key, value]) => {
    if (value.detected) {
      reasons.push({
        category: categoryNames[key] || key,
        detected: value.detected,
        confidence: value.confidence,
        reason: value.reason,
      });
    }
  });

  return reasons;
}

/**
 * Convert workflow result to FlaggedVideo format
 */
export function workflowResultToFlaggedVideo(
  result: {
    incidents: Array<{
      timestamp: number;
      confidence: number;
      categories: string;
      screenshotUrl: string;
      rating?: string;
      analysis?: ContentAnalysis;
    }>;
    totalFrames: number;
    processedAt: string;
  },
  metadata: {
    filename: string;
    durationSeconds?: number;
  }
): FlaggedVideo {
  const videoId = generateVideoId();

  // Convert incidents to flagged frames
  const flaggedFrames: FlaggedFrame[] = result.incidents.map((incident) => ({
    id: generateFrameId(),
    timestamp: formatTimestamp(incident.timestamp),
    confidence: incident.confidence,
    screenshot: incident.screenshotUrl,
    reason: incident.rating === "18+"
      ? "Explicit content detected"
      : "Inappropriate content detected",
    categories: incident.categories,
    rating: incident.rating as "safe" | "16+" | "18+" | undefined,
    categoryReasons: extractCategoryReasons(incident.analysis),
  }));

  const severity = calculateSeverity(result.incidents);
  const overallRating = calculateVideoRating(result.incidents);

  // Generate title from filename
  const title = `User Upload - ${metadata.filename.replace(/\.[^/.]+$/, "")}`;

  // Format upload date
  const uploadDate = new Date(result.processedAt).toISOString().split("T")[0];

  // Format duration
  const duration = metadata.durationSeconds
    ? formatDuration(metadata.durationSeconds)
    : "Unknown";

  return {
    id: videoId,
    title,
    thumbnail: flaggedFrames[0]?.screenshot || "", // Use first flagged frame as thumbnail
    uploadDate,
    duration,
    severity,
    flagCount: result.incidents.length,
    flaggedFrames,
    status: "flagged",
    overallRating,
  };
}
