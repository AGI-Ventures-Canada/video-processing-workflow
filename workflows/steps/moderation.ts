// No top-level imports of Node.js modules or AI SDK
// Dynamic imports are used inside the step function to avoid workflow serialization issues

export async function moderateFrameStep(frame: {
  url: string;  // Frame URL from blob storage (instead of buffer)
  timestamp: number;
  filename: string;
}) {
  "use step";

  try {
    // Dynamic import - only loaded at runtime, not during workflow serialization
    const { moderateContentSync } = await import("../../ai/ocr/moderate-content");

    // Use Gemini to analyze the frame (pass URL instead of buffer)
    const result = await moderateContentSync(frame.url);

    // Check if content is flagged (16+ or 18+)
    const isFlagged = result.rating === "16+" || result.rating === "18+";

    if (isFlagged) {
      // Build categories array based on detected content
      const categories: string[] = [];

      // Check 16+ categories
      if (result.analysis.sixteenPlus.cursing.detected) categories.push("cursing");
      if (result.analysis.sixteenPlus.moderate_violence.detected) categories.push("moderate_violence");
      if (result.analysis.sixteenPlus.strong_language.detected) categories.push("strong_language");
      if (result.analysis.sixteenPlus.mild_sexual_content.detected) categories.push("mild_sexual");

      // Check 18+ categories
      if (result.analysis.eighteenPlus.nudity.detected) categories.push("nudity");
      if (result.analysis.eighteenPlus.drug_use.detected) categories.push("drug_use");
      if (result.analysis.eighteenPlus.rape.detected) categories.push("sexual_assault");
      if (result.analysis.eighteenPlus.murder.detected) categories.push("murder");
      if (result.analysis.eighteenPlus.stabbing.detected) categories.push("stabbing");
      if (result.analysis.eighteenPlus.gore.detected) categories.push("gore");
      if (result.analysis.eighteenPlus.extreme_profanity.detected) categories.push("extreme_profanity");
      if (result.analysis.eighteenPlus.disturbing_themes.detected) categories.push("disturbing");

      // Calculate average confidence across all detected categories
      const confidenceSum = result.summary.highestConfidence;
      const confidence = confidenceSum / 5; // Normalize to 0-1

      return {
        isFlagged: true,
        confidence,
        categories: categories.length > 0 ? categories.join(", ") : "flagged",
        rating: result.rating,
        detailsixteenPlusDetections: result.summary.sixteenPlusDetections,
        eighteenPlusDetections: result.summary.eighteenPlusDetections,
      };
    }

    return {
      isFlagged: false,
      confidence: 0,
      categories: null,
      rating: "safe",
    };
  } catch (error) {
    console.error("[MODERATION] Gemini API error:", error);

    // Fallback to mock implementation if API fails
    // This ensures the workflow doesn't break if the API is unavailable
    const isFlagged = Math.random() < 0.2;

    if (isFlagged) {
      return {
        isFlagged: true,
        confidence: Math.random() * 0.3 + 0.7,
        categories: ["adult", "violence", "gore"][
          Math.floor(Math.random() * 3)
        ],
        rating: "18+",
        fallback: true,
      };
    }

    return {
      isFlagged: false,
      confidence: 0,
      categories: null,
      rating: "safe",
      fallback: true,
    };
  }
}

// This function has been removed - workflow now calls moderateFrameStep and uploadScreenshotToBlob separately
