import { StoryProvider } from './types';

export async function generateStory(): Promise<string> {
  return 'פעם אחת, בממלכה רחוקה... [סיפור לדוגמה שנוצר על ידי ה-mock provider, לצורך בדיקות בלבד]';
}

export const provider: StoryProvider = { generateStory };
