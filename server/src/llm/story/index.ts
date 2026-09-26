import config from '../../config';
import * as anthropicProvider from './anthropicProvider';
import * as openaiProvider from './openaiProvider';
import * as mockProvider from './mockProvider';
import { StoryProvider } from './types';

const PROVIDERS: Record<string, StoryProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  mock: mockProvider,
};

export function getStoryProvider(providerName = config.llmProvider): StoryProvider {
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unknown LLM_PROVIDER "${providerName}"`);
  }
  return provider;
}

export * from './types';
