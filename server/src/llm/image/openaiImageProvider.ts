import fs from 'fs';
import path from 'path';
import OpenAI, { toFile } from 'openai';
import config from '../../config';
import logger from '../../logger';
import { StoryFigureEntry } from '../../types';
import { ImageProvider, ScenePrompts } from './types';
import {
  ART_STYLE,
  GENERIC_FALLBACK_PROMPT,
  SCENE_SYSTEM_PROMPT,
  DEBRAND_SYSTEM_PROMPT,
  SAFETY_CLAUSE,
  PHOTO_MIMETYPES,
  findReferencePhoto,
  buildEditPrompt,
} from './common';

let client: OpenAI | null = null;

export function resetClientForTesting(): void {
  client = null;
}

function getClient(): OpenAI {
  if (!client) {
    if (!config.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

async function writeScenePrompts(
  storyText: string,
  figures: StoryFigureEntry[]
): Promise<ScenePrompts> {
  const castLines = figures
    .map((f) => `- ${f.name} (${f.category})${f.description ? `: ${f.description}` : ''}`)
    .join('\n');
  const userContent = `Cast:\n${castLines}\n\nStory:\n${storyText}`;

  const start = Date.now();
  const res = await getClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 700,
    messages: [
      { role: 'system', content: SCENE_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  });

  const raw = res.choices[0]?.message?.content?.trim() || '';
  const prompts = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (prompts.length < 3) {
    logger.error({ raw, durationMs: Date.now() - start }, 'scene prompt writer returned an unexpected number of lines');
    throw new Error(`expected 3 scene prompts, got ${prompts.length}`);
  }
  const fallback = prompts[3] || GENERIC_FALLBACK_PROMPT;
  logger.debug({ prompts, durationMs: Date.now() - start }, 'scene prompts written');
  return { scenes: prompts.slice(0, 3), fallback };
}

function isModerationBlocked(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'moderation_blocked';
}

const IMAGE_FORMAT = 'webp' as const;
const IMAGE_COMPRESSION = 75;

async function requestImage(prompt: string, referencePhoto: string | null): Promise<string> {
  const shared = {
    model: config.imageModel,
    size: '1024x1024' as const,
    quality: config.imageQuality,
    output_format: IMAGE_FORMAT,
    output_compression: IMAGE_COMPRESSION,
    n: 1,
  };

  const res = referencePhoto
    ? await getClient().images.edit({
        ...shared,
        image: await toFile(fs.createReadStream(referencePhoto), path.basename(referencePhoto), {
          type: PHOTO_MIMETYPES[path.extname(referencePhoto).toLowerCase()],
        }),
        prompt: buildEditPrompt(prompt),
      })
    : await getClient().images.generate({ ...shared, prompt });

  const b64 = res.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('image generation returned no data');
  }
  return `data:image/${IMAGE_FORMAT};base64,${b64}`;
}

async function debrandPrompt(prompt: string): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 500,
    messages: [
      { role: 'system', content: DEBRAND_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });
  const rewritten = res.choices[0]?.message?.content?.trim();
  if (!rewritten) {
    throw new Error('de-branding rewrite returned nothing');
  }
  return rewritten;
}

async function generateImage(
  prompt: string,
  index: number,
  fallbackPrompt: string,
  referencePhoto: string | null
): Promise<string | null> {
  const start = Date.now();
  const attempts: (() => Promise<string>)[] = [
    () => Promise.resolve(prompt),
    () => Promise.resolve(prompt),
    () => Promise.resolve(prompt + SAFETY_CLAUSE),
    () => debrandPrompt(prompt),
    () => Promise.resolve(fallbackPrompt),
  ];

  for (let attempt = 0; attempt < attempts.length; attempt++) {
    try {
      const image = await requestImage(await attempts[attempt](), referencePhoto);
      logger.debug(
        {
          index,
          attempt,
          model: config.imageModel,
          fromPhoto: Boolean(referencePhoto),
          durationMs: Date.now() - start,
        },
        'illustration generated'
      );
      return image;
    } catch (err) {
      const blocked = isModerationBlocked(err);
      const lastAttempt = attempt === attempts.length - 1;
      if (blocked && !lastAttempt) {
        logger.warn(
          { index, attempt, model: config.imageModel },
          'illustration blocked by the safety system, retrying'
        );
        continue;
      }
      logger.error(
        { err, index, attempt, blocked, model: config.imageModel, durationMs: Date.now() - start },
        'illustration generation failed'
      );
      return null;
    }
  }
  return null;
}

export async function generateStoryImages(
  storyText: string,
  figures: StoryFigureEntry[],
  onScene?: (index: number, image: string | null) => void
): Promise<(string | null)[]> {
  const { scenes, fallback } = await writeScenePrompts(storyText, figures);
  const referencePhoto = findReferencePhoto(figures);
  if (referencePhoto) {
    logger.info({ referencePhoto }, 'illustrating over a reference photo of the real place');
  }
  return Promise.all(
    scenes.map(async (prompt, index) => {
      const image = await generateImage(prompt, index, fallback, referencePhoto);
      onScene?.(index, image);
      return image;
    })
  );
}

export const provider: ImageProvider = { generateStoryImages };
