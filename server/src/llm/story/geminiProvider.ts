import { GoogleGenAI } from '@google/genai';
import config from '../../config';
import logger from '../../logger';
import { LLMPrompt } from '../../types';
import { StoryProvider } from './types';

let client: GoogleGenAI | null = null;

export function resetClientForTesting(): void {
  client = null;
}

function getClient(): GoogleGenAI {
  if (!client) {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return client;
}

export async function generateStory({ system, user, maxTokens }: LLMPrompt): Promise<string> {
  const start = Date.now();
  try {
    const response = await getClient().models.generateContent({
      model: config.llmModel,
      contents: user,
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
      },
    });

    const text = (response.text || '').trim();
    logger.debug(
      { model: config.llmModel, durationMs: Date.now() - start, usage: response.usageMetadata },
      'gemini generateContent succeeded'
    );
    return text;
  } catch (err) {
    logger.error(
      { err, model: config.llmModel, durationMs: Date.now() - start },
      'gemini generateContent failed'
    );
    throw err;
  }
}

export const provider: StoryProvider = { generateStory };
