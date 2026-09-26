import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getStoryProvider } from '../../src/llm/story';

test('getStoryProvider returns mock provider when configured', () => {
  const provider = getStoryProvider('mock');
  assert.ok(provider);
  assert.equal(typeof provider.generateStory, 'function');
});

test('getStoryProvider throws for unknown provider', () => {
  assert.throws(() => getStoryProvider('nonexistent'), /Unknown LLM_PROVIDER/);
});
