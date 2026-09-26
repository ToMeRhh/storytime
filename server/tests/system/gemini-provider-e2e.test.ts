import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, cleanup } from './testApp';
import config from '../../src/config';
import { getStoryProvider } from '../../src/llm/story';
import { getImageProvider } from '../../src/llm/image';

test.after(() => cleanup());

test('e2e: providers can be resolved dynamically for Gemini', async () => {
  // Verify story provider factory can resolve gemini
  const storyProvider = getStoryProvider('gemini');
  assert.ok(storyProvider);
  assert.equal(typeof storyProvider.generateStory, 'function');

  // Verify image provider factory can resolve gemini
  const imageProvider = getImageProvider('gemini');
  assert.ok(imageProvider);
  assert.equal(typeof imageProvider.generateStoryImages, 'function');
});

test('e2e: full story lifecycle with mock providers and image job polling', async () => {
  // Set image provider to mock to test full image generation job
  const originalImgProvider = config.imageProvider;
  config.imageProvider = 'mock';

  // 1. Create a story
  const created = await request(app).post('/api/stories');
  assert.equal(created.status, 201);
  const storyId = created.body.id;

  // 2. Fetch seed figures
  const figuresRes = await request(app).get('/api/figures');
  const character = figuresRes.body.find((f: { category: string }) => f.category === 'character');
  const location = figuresRes.body.find((f: { category: string }) => f.category === 'location');
  const mood = figuresRes.body.find((f: { category: string }) => f.category === 'mood');

  // Add the required figures
  await request(app).post(`/api/stories/${storyId}/figures`).send({ uid: character.uid });
  await request(app).post(`/api/stories/${storyId}/figures`).send({ uid: location.uid });
  await request(app).post(`/api/stories/${storyId}/figures`).send({ uid: mood.uid });

  // 3. Generate story with images enabled
  const genRes = await request(app)
    .post(`/api/stories/${storyId}/generate`)
    .send({ length: 'short', generateImages: true });

  assert.equal(genRes.status, 200);
  assert.equal(genRes.body.status, 'generated');
  assert.ok(genRes.body.storyText);

  // 4. Poll images endpoint
  const imagesRes = await request(app).get(`/api/stories/${storyId}/images`);
  assert.equal(imagesRes.status, 200);
  assert.ok(['pending', 'done', 'none'].includes(imagesRes.body.status));

  config.imageProvider = originalImgProvider;
});
