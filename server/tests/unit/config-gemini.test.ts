import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDefaultLlmModel } from '../../src/config';

test('resolveDefaultLlmModel returns gemini-3.8-flash for gemini provider when LLM_MODEL is not set', () => {
  assert.equal(resolveDefaultLlmModel('gemini', undefined), 'gemini-3.8-flash');
});

test('resolveDefaultLlmModel honors explicit LLM_MODEL override', () => {
  assert.equal(resolveDefaultLlmModel('gemini', 'gemini-3.7-flash'), 'gemini-3.7-flash');
});

test('resolveDefaultLlmModel defaults appropriately for other providers', () => {
  assert.equal(resolveDefaultLlmModel('openai', undefined), 'gpt-4.1');
  assert.equal(resolveDefaultLlmModel('anthropic', undefined), 'claude-haiku-4-5-20251001');
});
