import { google } from '@ai-sdk/google';

/**
 * Create a Google Gemini vision model for content moderation
 * @returns Configured Gemini model instance
 */
export function createGeminiVisionModel() {
  // Validate API key
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY environment variable is required when using Gemini provider');
  }

  // Return configured model with vision capabilities
  return google('gemini-2.5-flash-lite');
}
