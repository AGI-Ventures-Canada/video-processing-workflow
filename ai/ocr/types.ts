import { z } from 'zod';

// Schema for individual category detection
export const categoryDetectionSchema = z.object({
  detected: z.boolean().describe('Whether this content category was detected'),
  confidence: z.number().min(1).max(5).describe('Confidence level from 1 (low) to 5 (high)'),
  reason: z.string().describe('Brief explanation (1-2 sentences) for why this category was scored this way'),
});

// Schema for 16+ content categories
export const sixteenPlusSchema = z.object({
  cursing: categoryDetectionSchema.describe('Cursing or mild profanity'),
  moderate_violence: categoryDetectionSchema.describe('Moderate violence with blood, but no gore or stabbing'),
  strong_language: categoryDetectionSchema.describe('Strong language, but not extreme profanity'),
  mild_sexual_content: categoryDetectionSchema.describe('Suggestive content or kissing'),
});

// Schema for 18+ content categories
export const eighteenPlusSchema = z.object({
  nudity: categoryDetectionSchema.describe('Nudity or explicit sexual activities'),
  drug_use: categoryDetectionSchema.describe('Drug use or substance abuse'),
  rape: categoryDetectionSchema.describe('Sexual assault or rape'),
  murder: categoryDetectionSchema.describe('Murder or killing'),
  stabbing: categoryDetectionSchema.describe('Stabbing or piercing violence'),
  gore: categoryDetectionSchema.describe('Gore or graphic violence'),
  extreme_profanity: categoryDetectionSchema.describe('Frequent extreme profanity'),
  disturbing_themes: categoryDetectionSchema.describe('Disturbing themes such as abuse'),
});

// Combined content analysis schema
export const contentAnalysisSchema = z.object({
  sixteenPlus: sixteenPlusSchema.describe('Content categories for 16+ rating'),
  eighteenPlus: eighteenPlusSchema.describe('Content categories for 18+ rating'),
});

// TypeScript types derived from schemas
export type CategoryDetection = z.infer<typeof categoryDetectionSchema>;
export type SixteenPlusCategories = z.infer<typeof sixteenPlusSchema>;
export type EighteenPlusCategories = z.infer<typeof eighteenPlusSchema>;
export type ContentAnalysis = z.infer<typeof contentAnalysisSchema>;

// Content rating result
export interface ContentRating {
  rating: 'safe' | '16+' | '18+';
  analysis: ContentAnalysis;
  summary: {
    sixteenPlusDetections: number;
    eighteenPlusDetections: number;
    highestConfidence: number;
  };
}
