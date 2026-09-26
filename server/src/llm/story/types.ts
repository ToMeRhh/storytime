import { LLMPrompt } from '../../types';

export interface StoryProvider {
  generateStory(prompt: LLMPrompt): Promise<string>;
}
