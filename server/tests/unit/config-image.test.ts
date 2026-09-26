import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDefaultImageModel, isImageGenerationConfigured } from '../../src/config';

test('resolveDefaultImageModel defaults to gemini-3.1-flash-image for gemini', () => {
  assert.equal(resolveDefaultImageModel('gemini', undefined), 'gemini-3.1-flash-image');
});

test('resolveDefaultImageModel defaults to gpt-image-1.5 for openai', () => {
  assert.equal(resolveDefaultImageModel('openai', undefined), 'gpt-image-1.5');
});

test('resolveDefaultImageModel honors explicit IMAGE_MODEL override', () => {
  assert.equal(resolveDefaultImageModel('gemini', 'gemini-3.1-flash-lite-image'), 'gemini-3.1-flash-lite-image');
});

test('isImageGenerationConfigured requires appropriate key per provider', () => {
  assert.equal(isImageGenerationConfigured('gemini', { geminiApiKey: '', openaiApiKey: 'sk-123' }), false);
  assert.equal(isImageGenerationConfigured('gemini', { geminiApiKey: 'AIza...', openaiApiKey: '' }), true);
  assert.equal(isImageGenerationConfigured('openai', { geminiApiKey: 'AIza...', openaiApiKey: '' }), false);
  assert.equal(isImageGenerationConfigured('openai', { geminiApiKey: '', openaiApiKey: 'sk-123' }), true);
  assert.equal(isImageGenerationConfigured('mock', { geminiApiKey: '', openaiApiKey: '' }), true);
});
