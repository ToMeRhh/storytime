import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  llmProvider: string;
  llmModel: string;
  anthropicApiKey: string;
  openaiApiKey: string;
  geminiApiKey: string;
  generateImages: boolean;
  imageProvider: 'openai' | 'gemini' | 'mock';
  imageModel: string;
  imageQuality: 'low' | 'medium' | 'high';
  dbPath: string;
  figuresPath: string;
  referencePhotosPath: string;
  logLevel: string;
  logPretty: boolean;
}

export function resolveDefaultLlmModel(provider: string, envModel = process.env.LLM_MODEL): string {
  if (envModel) return envModel;
  switch (provider) {
    case 'gemini':
      return 'gemini-3.8-flash';
    case 'anthropic':
      return 'claude-haiku-4-5-20251001';
    case 'openai':
    default:
      return 'gpt-4.1';
  }
}

export function resolveDefaultImageModel(provider: string, envModel = process.env.IMAGE_MODEL): string {
  if (envModel) return envModel;
  switch (provider) {
    case 'gemini':
      return 'gemini-3.1-flash-image';
    case 'openai':
    default:
      return 'gpt-image-1.5';
  }
}

export function isImageGenerationConfigured(
  provider: string,
  keys: { geminiApiKey?: string; openaiApiKey?: string }
): boolean {
  switch (provider) {
    case 'gemini':
      return Boolean(keys.geminiApiKey);
    case 'openai':
      return Boolean(keys.openaiApiKey);
    case 'mock':
      return true;
    default:
      return false;
  }
}

const llmProvider = process.env.LLM_PROVIDER || 'openai';
const imageProvider = (process.env.IMAGE_PROVIDER || 'openai') as 'openai' | 'gemini' | 'mock';

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10) || 3000,
  llmProvider,
  llmModel: resolveDefaultLlmModel(llmProvider),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  generateImages: (process.env.GENERATE_IMAGES ?? 'true') === 'true',
  imageProvider,
  imageModel: resolveDefaultImageModel(imageProvider),
  // 'low' renders in roughly half the time (~11s vs ~21s per image) and costs less, which is
  // what the illustrations ship at; 'medium' gives a flatter, softer storybook look for more
  // money and time. Anything unrecognized falls back to 'low'.
  imageQuality: (['low', 'medium', 'high'] as const).includes(
    process.env.IMAGE_QUALITY as 'low' | 'medium' | 'high'
  )
    ? (process.env.IMAGE_QUALITY as 'low' | 'medium' | 'high')
    : 'low',
  // __dirname is server/src in dev (tsx runs .ts in place) and server/dist in prod
  // (tsc-compiled) - both are direct children of server/, so '..' always lands
  // back on server/ regardless of which mode is running.
  dbPath: process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(__dirname, '..', 'data', 'stories.db'),
  figuresPath: process.env.FIGURES_PATH
    ? path.resolve(process.env.FIGURES_PATH)
    : path.join(__dirname, '..', 'src', 'data', 'figures.json'),
  // Real photographs, one per figure uid (e.g. PLACEHOLDERLOC10.jpg for חדר הילדים). When a
  // story's location has one, the illustrations are painted over that photo instead of being
  // imagined from scratch, so the scene happens in the actual room. Lives under data/ because
  // that is the mounted volume in docker-compose: photos survive a redeploy and stay off the
  // static-served ui/ directory.
  referencePhotosPath: process.env.REFERENCE_PHOTOS_PATH
    ? path.resolve(process.env.REFERENCE_PHOTOS_PATH)
    : path.join(__dirname, '..', 'data', 'reference-photos'),
  // 'silent' in tests by default (LLM_PROVIDER=mock) keeps test output clean without an extra env var
  logLevel: process.env.LOG_LEVEL || (process.env.LLM_PROVIDER === 'mock' ? 'silent' : 'info'),
  logPretty: (process.env.LOG_PRETTY ?? 'true') === 'true',
};

export default config;
