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

test('buildImageContents reads reference photo asynchronously and constructs multimodal parts', async () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const tmpFile = path.join(os.tmpdir(), `test-photo-${Date.now()}.jpg`);
  await fs.promises.writeFile(tmpFile, 'fake-jpeg-bytes');

  try {
    let readFileAsyncCalled = false;
    const origReadFile = fs.promises.readFile;
    fs.promises.readFile = async (...args: any[]) => {
      readFileAsyncCalled = true;
      return origReadFile.apply(fs.promises, args);
    };

    const contents = await geminiImageProvider.buildImageContents('Draw in room', tmpFile);
    fs.promises.readFile = origReadFile;

    assert.ok(readFileAsyncCalled, 'expected fs.promises.readFile to be called');
    assert.ok(Array.isArray(contents), 'expected multimodal array');
    assert.equal(contents[0]?.inlineData?.mimeType, 'image/jpeg');
    assert.equal(contents[0]?.inlineData?.data, Buffer.from('fake-jpeg-bytes').toString('base64'));
  } finally {
    await fs.promises.unlink(tmpFile).catch(() => {});
  }
});
