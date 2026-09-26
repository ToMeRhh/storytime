import fs from 'fs';
import path from 'path';
import config from '../../config';
import { StoryFigureEntry } from '../../types';

// repeated verbatim in every scene prompt so the 3 images read as one consistent picture book,
// not 3 unrelated pieces of art
export const ART_STYLE =
  'Disney/Pixar-style 2D animated children\'s book illustration. Warm, whimsical, soft rounded ' +
  'shapes, gentle vibrant colors, expressive friendly character faces. Not photorealistic.';

// only used if the scene writer skips its 4th line
export const GENERIC_FALLBACK_PROMPT =
  'A wide, peaceful establishing view of a warm, magical storybook landscape. No people, no ' +
  `animals, no characters of any kind - only the empty landscape and its scenery. ${ART_STYLE}`;

export const SCENE_SYSTEM_PROMPT = `You write image-generation prompts for a children's picture book, based on a story you are given.

You will receive the full story text (in Hebrew) and the list of characters/places/mood/objects it was built from.

Output exactly 4 lines, one prompt per line, no numbering, no blank lines, no extra commentary:
1. A scene from the OPENING of the story.
2. A scene from the MIDDLE of the story - a key moment where something happens.
3. A scene from the ENDING of the story.
4. A fallback used only if one of the first three can't be drawn: a wide establishing view of the story's main setting with NO characters in it - no people, no animals, no creatures of any kind, only the empty landscape and its scenery.

Rules, all mandatory:
- Every prompt must be written in English.
- Only depict characters, creatures, and settings that literally appear in the given story and cast list. Never invent a new character (especially never add a human child or narrator who isn't in the story) and never omit a character who should be in that scene.
- Never name a real-world franchise character (superhero, comic-book, or animation-studio characters) and never describe one recognizably. When the cast contains one, depict an ORIGINAL character in the same role instead: keep the archetype (a mighty green-skinned giant, a brave masked night-hero, a small woodland fawn) but change the signature look - different costume colors, different garments, no trademark emblem, mask shape, or silhouette. A reader must not be able to name the original character.
- A cast entry may come with a description after the colon. Where it does, it is authoritative for how that character or place actually looks: carry its concrete details into every prompt that shows it. A described place is a real, specific place - draw that room or that landscape with its own furniture, colors and light, never a generic stand-in.
- Every time a character appears (in any of the 3 prompts), describe their concrete visual appearance the same way (species, coloring, notable features/outfit) so they look like the same character in all 3 images - don't just say "the lion", spell out what makes it recognizable.
- Absolutely no text, letters, words, numbers, speech bubbles, signs, or writing of any kind anywhere in the image.
- Each prompt must end with exactly this style instruction, verbatim: "${ART_STYLE}"`;

export const DEBRAND_SYSTEM_PROMPT = `You rewrite children's-book image prompts that an image model refused to draw.

The refusal is almost always because the scene depicts a recognizable copyrighted or trademarked character.

Rewrite the prompt so that every character is unmistakably ORIGINAL: keep the scene, setting, action, mood and the same number of characters, but replace any franchise name with a plain descriptive one and change each borrowed costume - different colors, different garments, no trademark emblem, mask shape, or silhouette.

Output only the rewritten prompt, on one line, with no commentary.`;

export const SAFETY_CLAUSE =
  ' Wholesome, innocent, age-appropriate for young children: fully clothed characters, ' +
  'friendly expressions, no violence, no scary imagery.';

export const PHOTO_MIMETYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const PHOTO_EXTENSIONS = Object.keys(PHOTO_MIMETYPES);

export function findReferencePhoto(figures: StoryFigureEntry[]): string | null {
  for (const figure of figures) {
    if (figure.category !== 'location') continue;
    for (const ext of PHOTO_EXTENSIONS) {
      const candidate = path.join(config.referencePhotosPath, `${figure.uid}${ext}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export function buildEditPrompt(prompt: string): string {
  return (
    'Repaint this photograph of a real room as a hand-illustrated scene from a children\'s ' +
    'picture book. Keep the room itself recognizable: the same layout, the same furniture in ' +
    'the same places, the same proportions, window and light direction. Do not photograph it - ' +
    'redraw every surface in the illustration style, warm and storybook-magical. Then set this ' +
    `scene inside that room: ${prompt}`
  );
}
