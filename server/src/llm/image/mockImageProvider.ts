import { StoryFigureEntry } from '../../types';
import { ImageProvider } from './types';

export async function generateStoryImages(
  _storyText: string,
  _figures: StoryFigureEntry[],
  onScene?: (index: number, image: string | null) => void
): Promise<(string | null)[]> {
  const images = [
    'data:image/webp;base64,mockScene0',
    'data:image/webp;base64,mockScene1',
    'data:image/webp;base64,mockScene2',
  ];
  images.forEach((img, idx) => onScene?.(idx, img));
  return images;
}

export const provider: ImageProvider = { generateStoryImages };
