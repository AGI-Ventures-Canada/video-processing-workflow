import { streamObject } from "ai";
import {
  contentAnalysisSchema,
  type ContentAnalysis,
  type ContentRating,
} from "./types";
import { matureContentRatingPrompt } from "../prompts/mature-content-rating";
import { getVisionModel } from "../providers/provider-factory";

/**
 * Analyzes an image for mature content using the configured AI provider
 * @param imageInput - Image URL or Buffer
 * @param description - Optional description for additional context
 * @returns Stream of content analysis results
 */
export async function moderateContent(
  imageInput: string | Buffer | URL,
  description?: string
) {

  // Prepare image for AI model
  let imageUrl: string | URL;

  if (Buffer.isBuffer(imageInput)) {
    // Convert Buffer to base64 data URL
    // Note: This can cause memory issues for large buffers
    // Prefer passing URLs directly when possible
    const base64 = imageInput.toString("base64");
    imageUrl = `data:image/jpeg;base64,${base64}`;
  } else if (typeof imageInput === "string") {
    // String input - URL or data URL
    imageUrl = imageInput;
  } else {
    // Already a URL object
    imageUrl = imageInput;
  }

  // Build the prompt
  let prompt = matureContentRatingPrompt;
  if (description) {
    prompt += `\n\nAdditional context: ${description}`;
  }

  const result = streamObject({
    model: getVisionModel(),
    schema: contentAnalysisSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", image: imageUrl },
        ],
      },
    ],
  });

  return result;
}

/**
 * Calculates the final content rating based on the analysis
 * @param analysis - The content analysis from the AI model
 * @returns Content rating with summary
 */
export function calculateRating(analysis: ContentAnalysis): ContentRating {
  const sixteenPlus = analysis.sixteenPlus;
  const eighteenPlus = analysis.eighteenPlus;

  // Count detections with confidence >= 3
  let sixteenPlusDetections = 0;
  let eighteenPlusDetections = 0;
  let highestConfidence = 0;

  // Check 16+ categories
  Object.values(sixteenPlus).forEach((category) => {
    if (category.detected && category.confidence >= 3) {
      sixteenPlusDetections++;
    }
    highestConfidence = Math.max(highestConfidence, category.confidence);
  });

  // Check 18+ categories
  Object.values(eighteenPlus).forEach((category) => {
    if (category.detected && category.confidence >= 3) {
      eighteenPlusDetections++;
    }
    highestConfidence = Math.max(highestConfidence, category.confidence);
  });

  // Determine rating
  let rating: "safe" | "16+" | "18+" = "safe";

  // If any 18+ content is detected with confidence >= 3, it's 18+
  if (eighteenPlusDetections > 0) {
    rating = "18+";
  }
  // If any 16+ content is detected with confidence >= 3, it's 16+
  else if (sixteenPlusDetections > 0) {
    rating = "16+";
  }

  return {
    rating,
    analysis,
    summary: {
      sixteenPlusDetections,
      eighteenPlusDetections,
      highestConfidence,
    },
  };
}

/**
 * Moderate content and return the final rating (non-streaming version)
 * Waits for the full analysis to complete before calculating rating
 */
export async function moderateContentSync(
  imageInput: string | Buffer | URL,
  description?: string
): Promise<ContentRating> {
  const stream = await moderateContent(imageInput, description);

  // Wait for the final complete object with timeout
  const timeoutMs = 120000; // 2 minute timeout
  const objectPromise = stream.object;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("AI API timeout after 2 minutes")),
      timeoutMs
    );
  });

  const object = await Promise.race([objectPromise, timeoutPromise]);

  return calculateRating(object);
}
