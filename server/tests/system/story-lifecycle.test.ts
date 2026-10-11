import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, cleanup } from './testApp';

test.after(() => cleanup());

async function pickFigureByCategory(category: string) {
  const res = await request(app).get('/api/figures');
  const figure = res.body.find((f: { category: string }) => f.category === category);
  assert.ok(figure, `no seed figure with category "${category}" - can't run this test`);
  return figure as { uid: string; name: string; category: string };
}

test('full story lifecycle: create -> add figures (new/duplicate/unknown) -> gate -> generate -> history', async () => {
  const character = await pickFigureByCategory('character');
  const location = await pickFigureByCategory('location');
  const mood = await pickFigureByCategory('mood');

  // 1. create
  const created = await request(app).post('/api/stories');
  assert.equal(created.status, 201);
  assert.equal(created.body.status, 'collecting');
  assert.deepEqual(created.body.figures, []);
  const storyId = created.body.id;

  // 2. uid not in the deck -> recognized:false, does not get added
  const unknownAdd = await request(app)
    .post(`/api/stories/${storyId}/figures`)
    .send({ uid: 'DOES-NOT-EXIST-UID' });
  assert.equal(unknownAdd.status, 200);
  assert.deepEqual(unknownAdd.body, { recognized: false });

  // 3. new figure -> recognized, not duplicate, added
  const firstAdd = await request(app)
    .post(`/api/stories/${storyId}/figures`)
    .send({ uid: character.uid });
  assert.equal(firstAdd.status, 200);
  assert.equal(firstAdd.body.recognized, true);
  assert.equal(firstAdd.body.duplicate, false);
  assert.equal(firstAdd.body.figures.length, 1);
  assert.equal('led' in firstAdd.body, false, 'the legacy led hint is gone from responses');

  // 4. same figure again (different casing/separators - normalization) -> duplicate, not re-added
  const messyUid = character.uid.toLowerCase().split('').join('-');
  const dupeAdd = await request(app)
    .post(`/api/stories/${storyId}/figures`)
    .send({ uid: messyUid });
  assert.equal(dupeAdd.status, 200);
  assert.equal(dupeAdd.body.recognized, true);
  assert.equal(dupeAdd.body.duplicate, true);
  assert.equal(dupeAdd.body.figures.length, 1);

  // 5. generate before the gate is satisfied -> 422 listing exactly what's missing
  const blockedGenerate = await request(app).post(`/api/stories/${storyId}/generate`);
  assert.equal(blockedGenerate.status, 422);
  assert.deepEqual(new Set(blockedGenerate.body.missing), new Set(['location', 'mood']));

  // a story that only has figures added but was never generated must not show up in history
  const historyWhileCollecting = await request(app).get('/api/stories');
  assert.ok(
    !historyWhileCollecting.body.some((s: { id: string }) => s.id === storyId),
    'an ungenerated ("collecting") story should not appear in history'
  );

  // 6. satisfy the gate
  await request(app).post(`/api/stories/${storyId}/figures`).send({ uid: location.uid });
  await request(app).post(`/api/stories/${storyId}/figures`).send({ uid: mood.uid });

  const beforeGenerate = await request(app).get(`/api/stories/${storyId}`);
  assert.equal(beforeGenerate.body.figures.length, 3);
  assert.equal(beforeGenerate.body.status, 'collecting');

  // 7. generate (mock provider - no network/API key needed)
  const generated = await request(app).post(`/api/stories/${storyId}/generate`);
  assert.equal(generated.status, 200);
  assert.equal(generated.body.status, 'generated');
  assert.ok(generated.body.storyText && generated.body.storyText.length > 0);
  assert.ok(generated.body.generatedAt);

  // 8. fetching the story again reflects the generated text
  const fetched = await request(app).get(`/api/stories/${storyId}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.status, 'generated');
  assert.equal(fetched.body.storyText, generated.body.storyText);

  // 9. now that it's generated, it shows up in history with the right figure count and a snippet
  const history = await request(app).get('/api/stories');
  assert.equal(history.status, 200);
  const entry = history.body.find((s: { id: string }) => s.id === storyId);
  assert.ok(entry, 'generated story missing from history list');
  assert.equal(entry.status, 'generated');
  assert.equal(entry.figureCount, 3);
  assert.ok(entry.snippet && entry.snippet.length > 0);
});

test('removing a figure takes it out of the story', async () => {
  const character = await pickFigureByCategory('character');
  const created = await request(app).post('/api/stories');
  const storyId = created.body.id;

  const added = await request(app)
    .post(`/api/stories/${storyId}/figures`)
    .send({ uid: character.uid });
  const entryId = added.body.figures[0].entryId;

  const del = await request(app).delete(`/api/stories/${storyId}/figures/${entryId}`);
  assert.equal(del.status, 204);

  const after = await request(app).get(`/api/stories/${storyId}`);
  assert.deepEqual(after.body.figures, []);

  const delAgain = await request(app).delete(`/api/stories/${storyId}/figures/${entryId}`);
  assert.equal(delAgain.status, 404);
});
