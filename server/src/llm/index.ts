import { getStoryProvider } from './story';
import { getImageProvider } from './image';
import { LLMProvider, StoryFigureEntry } from '../types';

export function getProvider(providerName?: string): LLMProvider {
  return getStoryProvider(providerName);
}

export function generateStoryImages(
  storyText: string,
  figures: StoryFigureEntry[],
  onScene?: (index: number, image: string | null) => void
): Promise<(string | null)[]> {
  return getImageProvider().generateStoryImages(storyText, figures, onScene);
}

export { getStoryProvider } from './story';
export { getImageProvider } from './image';
