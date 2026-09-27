import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as geminiProvider from '../../src/llm/story/geminiProvider';
import config from '../../src/config';

test('geminiProvider throws error if GEMINI_API_KEY is missing', async () => {
  const originalKey = config.geminiApiKey;
  config.geminiApiKey = '';
  geminiProvider.resetClientForTesting();
  await assert.rejects(
    () => geminiProvider.generateStory({ system: 'system', user: 'user', maxTokens: 100 }),
    /GEMINI_API_KEY is not set/
  );
  config.geminiApiKey = originalKey;
});

test('getStoryProvider returns gemini provider when selected', () => {
  const { getStoryProvider } = require('../../src/llm/story');
  const provider = getStoryProvider('gemini');
  assert.ok(provider);
  assert.equal(typeof provider.generateStory, 'function');
});
