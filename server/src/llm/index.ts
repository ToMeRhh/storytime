import { getStoryProvider } from './story';
import { LLMProvider } from '../types';

export function getProvider(providerName?: string): LLMProvider {
  return getStoryProvider(providerName);
}

export * from './imageProvider';
