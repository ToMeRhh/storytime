import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as storyTypes from '../../src/llm/story/types';
import * as imageTypes from '../../src/llm/image/types';
import { StoryProvider } from '../../src/llm/story/types';
import { ImageProvider } from '../../src/llm/image/types';

test('Provider interfaces can be typed and instantiated', () => {
  const dummyStory: StoryProvider = {
    async generateStory() { return 'title\n\nbody'; }
  };
  const dummyImage: ImageProvider = {
    async generateStoryImages() { return ['data:image/webp;base64,123']; }
  };
  assert.ok(storyTypes);
  assert.ok(imageTypes);
  assert.ok(dummyStory);
  assert.ok(dummyImage);
});
