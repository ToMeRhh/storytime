import config from '../../config';
import { ImageProvider } from './types';
import * as openaiImageProvider from './openaiImageProvider';
import * as geminiImageProvider from './geminiImageProvider';
import * as mockImageProvider from './mockImageProvider';

const PROVIDERS: Record<string, ImageProvider> = {
  openai: openaiImageProvider,
  gemini: geminiImageProvider,
  mock: mockImageProvider,
};

export function getImageProvider(providerName = config.imageProvider || 'openai'): ImageProvider {
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unknown IMAGE_PROVIDER "${providerName}"`);
  }
  return provider;
}

export * from './types';
export * from './common';
