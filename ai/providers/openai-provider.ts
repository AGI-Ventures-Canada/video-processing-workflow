import { openai } from '@ai-sdk/openai';

/**
 * Create an OpenAI vision model for content moderation
 * @returns Configured OpenAI model instance
 */
export function createOpenAIVisionModel() {
  // Validate API key
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required when using OpenAI provider');
  }

  // Return configured model with vision capabilities
  return openai('gpt-5');
}
