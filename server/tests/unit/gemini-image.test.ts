import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as geminiImageProvider from '../../src/llm/image/geminiImageProvider';
import config from '../../src/config';

test('geminiImageProvider throws if GEMINI_API_KEY is missing when generating scene prompts', async () => {
  const originalKey = config.geminiApiKey;
  config.geminiApiKey = '';
  geminiImageProvider.resetClientForTesting();
  await assert.rejects(
    () => geminiImageProvider.generateStoryImages('test story', []),
    /GEMINI_API_KEY is not set/
  );
  config.geminiApiKey = originalKey;
});

test('getImageProvider returns gemini image provider when selected', () => {
  const { getImageProvider } = require('../../src/llm/image');
  const provider = getImageProvider('gemini');
  assert.ok(provider);
  assert.equal(typeof provider.generateStoryImages, 'function');
});
