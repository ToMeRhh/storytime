import { StoryFigureEntry } from '../../types';

export interface ImageProvider {
  generateStoryImages(
    storyText: string,
    figures: StoryFigureEntry[],
    onScene?: (index: number, image: string | null) => void
  ): Promise<(string | null)[]>;
}

export interface ScenePrompts {
  scenes: string[];
  fallback: string;
}
