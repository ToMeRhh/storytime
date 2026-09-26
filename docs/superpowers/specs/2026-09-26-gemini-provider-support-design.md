# Gemini Provider Support Design Specification

## Overview

Storytime currently uses OpenAI and Anthropic for story generation, and OpenAI exclusively for scene prompt writing and image illustration. This specification defines the design to add Google Gemini as a first-class provider for both:
1. **Story Generation**: Generating the Hebrew story text via Google Gemini models, controlled by `LLM_PROVIDER=gemini` and `LLM_MODEL`.
2. **Image Generation**: Generating illustrations via Google Gemini image models, controlled by `IMAGE_PROVIDER=gemini` and `IMAGE_MODEL`, eliminating any mandatory dependency on an OpenAI API key.

Configuration is handled entirely through server environment variables.

---

## Architecture & Directory Reorganization

The `server/src/llm/` directory is reorganized into distinct sub-domains for text (story) and image generation:

```
server/src/llm/
├── index.ts                     # Backward-compatible barrel export for callers
├── types.ts                     # Common LLM types and provider interfaces
├── promptBuilder.ts             # Hebrew bedtime story prompt builder (shared)
├── story/                       # Story text generation
│   ├── types.ts                 # StoryProvider interface
│   ├── index.ts                 # Factory: getStoryProvider()
│   ├── geminiProvider.ts        # Gemini story generation implementation
│   ├── openaiProvider.ts        # OpenAI story generation implementation
│   ├── anthropicProvider.ts     # Anthropic story generation implementation
│   └── mockProvider.ts          # Offline mock provider for tests
└── image/                       # Illustration generation
    ├── types.ts                 # ImageProvider interface & scene prompt types
    ├── index.ts                 # Factory: getImageProvider()
    ├── common.ts                # Shared helpers (reference photos, prompt builders, constants)
    ├── geminiImageProvider.ts   # Gemini image generation implementation
    ├── openaiImageProvider.ts   # OpenAI image generation implementation
    └── mockImageProvider.ts     # Offline mock image provider
```

---

## Component Interfaces

### 1. Story Provider Interface (`server/src/llm/story/types.ts`)

```typescript
import { LLMPrompt } from '../../types';

export interface StoryProvider {
  generateStory(prompt: LLMPrompt): Promise<string>;
}
```

### 2. Image Provider Interface (`server/src/llm/image/types.ts`)

```typescript
import { StoryFigureEntry } from '../../types';

export interface ImageProvider {
  generateStoryImages(
    storyText: string,
    figures: StoryFigureEntry[],
    onScene?: (index: number, image: string | null) => void
  ): Promise<(string | null)[]>;
}
```

---

## Configuration Updates (`server/src/config.ts`)

### Environment Variables

| Variable | Type | Allowed Values | Default | Description |
|---|---|---|---|---|
| `LLM_PROVIDER` | string | `gemini` \| `openai` \| `anthropic` \| `mock` | `openai` | Text generation provider for the story |
| `LLM_MODEL` | string | model identifier | Provider-dependent | Model for story text. When `gemini`: `gemini-3.8-flash`. When `openai`: `gpt-4.1`. When `anthropic`: `claude-haiku-4-5-20251001` |
| `GEMINI_API_KEY` | string | API key string | `""` | Google Gemini API key |
| `IMAGE_PROVIDER` | string | `openai` \| `gemini` \| `mock` | `openai` | Provider for illustrations and scene prompt writing |
| `IMAGE_MODEL` | string | model identifier | Provider-dependent | Model for image generation. When `gemini`: `gemini-3.1-flash-image`. When `openai`: `gpt-image-1.5` |
| `GENERATE_IMAGES` | boolean | `true` \| `false` | `true` | Master switch for illustrations |

### Model Defaults Logic in `config.ts`

```typescript
function resolveDefaultLlmModel(provider: string): string {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL;
  switch (provider) {
    case 'gemini':
      return 'gemini-3.8-flash';
    case 'anthropic':
      return 'claude-haiku-4-5-20251001';
    case 'openai':
    default:
      return 'gpt-4.1';
  }
}

function resolveDefaultImageModel(provider: string): string {
  if (process.env.IMAGE_MODEL) return process.env.IMAGE_MODEL;
  switch (provider) {
    case 'gemini':
      return 'gemini-3.1-flash-image';
    case 'openai':
    default:
      return 'gpt-image-1.5';
  }
}
```

---

## Implementation Details

### Phase 1: Pre-work & Refactoring
1. **Extract Interfaces**:
   - Define `StoryProvider` in `server/src/llm/story/types.ts`.
   - Define `ImageProvider` in `server/src/llm/image/types.ts`.
2. **Move Existing Providers**:
   - Move OpenAI, Anthropic, and Mock text providers into `server/src/llm/story/`.
   - Move OpenAI image logic into `server/src/llm/image/openaiImageProvider.ts`.
   - Extract shared photo lookup and prompt building to `server/src/llm/image/common.ts`.
3. **Factories**:
   - `server/src/llm/story/index.ts`: `getStoryProvider()` maps `config.llmProvider` to the provider instance.
   - `server/src/llm/image/index.ts`: `getImageProvider()` maps `config.imageProvider` to the provider instance.
   - Maintain `server/src/llm/index.ts` re-exporting `getProvider` (alias for `getStoryProvider`) and `generateStoryImages` to preserve compatibility with existing service calls.

### Phase 2: Gemini Story Provider
1. **SDK**: Add `@google/genai` to `server/package.json`.
2. **Provider**: `server/src/llm/story/geminiProvider.ts`:
   - Initialize `GoogleGenAI` with `config.geminiApiKey`.
   - Call `ai.models.generateContent({ model: config.llmModel, contents: user, config: { systemInstruction: system, maxOutputTokens: maxTokens } })`.
   - Extract `response.text`.
   - Structured logging with latency, token usage (`usageMetadata`), and errors.
3. **Factory Registration**: Register `gemini` in `story/index.ts`.

### Phase 3: Gemini Image Provider
1. **Scene Prompt Writing**:
   - In `server/src/llm/image/geminiImageProvider.ts`, use `ai.models.generateContent` with `gemini-3.8-flash` and `SCENE_SYSTEM_PROMPT` to generate the 3 scene prompts and 1 fallback prompt.
   - Use `gemini-3.8-flash` with `DEBRAND_SYSTEM_PROMPT` if de-branding is required.
2. **Image Generation**:
   - Call `ai.models.generateContent` with `model: config.imageModel` (default `gemini-3.1-flash-image`) and `config: { responseModalities: ['IMAGE'] }`.
   - **Reference Photos**: If `findReferencePhoto(figures)` finds a room photo, convert the image file into an inline base64 part and include it in `contents` with the repaint prompt.
   - **Output Handling**: Extract base64 image data from `candidate.content.parts[0].inlineData`, format as `data:${mimeType};base64,${data}`.
3. **Resilience Ladder**:
   - Step 1: Prompt as-is.
   - Step 2: Immediate retry (safety non-determinism).
   - Step 3: Wholesomeness clause appended.
   - Step 4: De-branded prompt via LLM rewrite.
   - Step 5: Empty landscape fallback prompt.
   - Non-blocking: If all 5 attempts fail, return `null` for that scene slot.
4. **Service Integration (`storyService.ts`)**:
   - Update image gating logic to check `(config.imageProvider === 'gemini' && config.geminiApiKey) || (config.imageProvider === 'openai' && config.openaiApiKey)`.
   - Delegate to `getImageProvider().generateStoryImages(...)`.

---

## Deployment & Documentation

1. **Docker Compose (`docker-compose.yml`)**:
   - Add `GEMINI_API_KEY=${GEMINI_API_KEY:-}`.
   - Add `IMAGE_PROVIDER=${IMAGE_PROVIDER:-openai}`.
2. **Documentation (`README.md`, `server/README.md`)**:
   - Add documentation and configuration table entries for `GEMINI_API_KEY`, `IMAGE_PROVIDER`, `LLM_PROVIDER=gemini`, and the model defaults (`gemini-3.8-flash` and `gemini-3.1-flash-image`).
