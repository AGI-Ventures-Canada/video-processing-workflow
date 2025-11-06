import { createOpenAIVisionModel } from './openai-provider';
import { createGeminiVisionModel } from './gemini-provider';

/**
 * Supported AI providers for content moderation
 */
export type AIProvider = 'openai' | 'gemini';

/**
 * Get the configured AI provider from environment variables
 * Defaults to 'gemini' if not specified
 */
function getConfiguredProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase() as AIProvider;

  if (provider && !['openai', 'gemini'].includes(provider)) {
    console.warn(`Invalid AI_PROVIDER value: "${provider}". Defaulting to "gemini".`);
    return 'gemini';
  }

  return provider || 'gemini';
}

/**
 * Get the appropriate vision model based on the configured provider
 * @returns Configured AI model instance for vision/moderation tasks
 */
export function getVisionModel() {
  const provider = getConfiguredProvider();

  console.log(`[AI Provider] Using ${provider} for content moderation`);

  switch (provider) {
    case 'openai':
      return createOpenAIVisionModel();
    case 'gemini':
      return createGeminiVisionModel();
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
