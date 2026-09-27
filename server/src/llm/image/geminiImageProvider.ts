import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import config from '../../config';
import logger from '../../logger';
import { StoryFigureEntry } from '../../types';
import { ImageProvider, ScenePrompts } from './types';
import {
  GENERIC_FALLBACK_PROMPT,
  SCENE_SYSTEM_PROMPT,
  DEBRAND_SYSTEM_PROMPT,
  SAFETY_CLAUSE,
  PHOTO_MIMETYPES,
  findReferencePhoto,
  buildEditPrompt,
} from './common';

let client: GoogleGenAI | null = null;

export function resetClientForTesting(): void {
  client = null;
}

function getClient(): GoogleGenAI {
  if (!client) {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return client;
}

function getTextModel(): string {
  return config.llmProvider === 'gemini' ? config.llmModel : 'gemini-3.8-flash';
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
  const res = await getClient().models.generateContent({
    model: getTextModel(),
    contents: userContent,
    config: {
      systemInstruction: SCENE_SYSTEM_PROMPT,
      maxOutputTokens: 700,
    },
  });

  const raw = (res.text || '').trim();
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
  if (typeof err === 'object' && err !== null) {
    const msg = String((err as { message?: string }).message || '').toLowerCase();
    const status = (err as { status?: number }).status;
    return msg.includes('safety') || msg.includes('block') || msg.includes('filter') || status === 400;
  }
  return false;
}

export type ImageContentPart =
  | string
  | {
      inlineData: {
        mimeType: string;
        data: string;
      };
    };

export async function buildImageContents(
  prompt: string,
  referencePhoto: string | null
): Promise<ImageContentPart[] | string> {
  if (!referencePhoto) {
    return prompt;
  }
  const ext = path.extname(referencePhoto).toLowerCase();
  const mimeType = PHOTO_MIMETYPES[ext] || 'image/jpeg';
  const photoBuffer = await fs.promises.readFile(referencePhoto);
  const photoBase64 = photoBuffer.toString('base64');
  return [
    {
      inlineData: {
        mimeType,
        data: photoBase64,
      },
    },
    buildEditPrompt(prompt),
  ];
}

async function requestImage(prompt: string, referencePhoto: string | null): Promise<string> {
  const contents = await buildImageContents(prompt, referencePhoto);

  const res = await getClient().models.generateContent({
    model: config.imageModel,
    contents: contents as string | ImageContentPart[],
    config: {
      responseModalities: ['IMAGE'],
    },
  });

  const candidate = res.candidates?.[0];
  const parts = candidate?.content?.parts;
  const imagePart = parts?.find((p) => p.inlineData);
  if (!imagePart || !imagePart.inlineData?.data) {
    throw new Error('Gemini image generation returned no image data');
  }

  const mimeType = imagePart.inlineData.mimeType || 'image/png';
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

async function debrandPrompt(prompt: string): Promise<string> {
  const res = await getClient().models.generateContent({
    model: getTextModel(),
    contents: prompt,
    config: {
      systemInstruction: DEBRAND_SYSTEM_PROMPT,
      maxOutputTokens: 500,
    },
  });
  const rewritten = (res.text || '').trim();
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
        'gemini illustration generated'
      );
      return image;
    } catch (err) {
      const blocked = isModerationBlocked(err);
      const lastAttempt = attempt === attempts.length - 1;
      if (blocked && !lastAttempt) {
        logger.warn(
          { index, attempt, model: config.imageModel },
          'gemini illustration blocked by safety system, retrying'
        );
        continue;
      }
      logger.error(
        { err, index, attempt, blocked, model: config.imageModel, durationMs: Date.now() - start },
        'gemini illustration generation failed'
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
