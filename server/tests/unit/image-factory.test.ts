import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getImageProvider } from '../../src/llm/image';
import { buildEditPrompt } from '../../src/llm/image/common';

test('buildEditPrompt formats prompt around room photo', () => {
  const res = buildEditPrompt('A dog in the room');
  assert.ok(res.includes('Repaint this photograph'));
  assert.ok(res.includes('A dog in the room'));
});

test('getImageProvider returns mock image provider when selected', () => {
  const provider = getImageProvider('mock');
  assert.ok(provider);
  assert.equal(typeof provider.generateStoryImages, 'function');
});
