import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, cleanup } from './testApp';

test.after(() => cleanup());

interface FigureBody {
  uid: string;
  name: string;
  category: string;
  description: string;
}

async function listDeck(): Promise<FigureBody[]> {
  const res = await request(app).get('/api/figures');
  return res.body as FigureBody[];
}

test('POST /api/figures without a uid generates one and adds the figure to the deck', async () => {
  const created = await request(app)
    .post('/api/figures')
    .send({ name: 'דוב ישנוני', category: 'character', description: 'דוב גדול ועדין' });

  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'דוב ישנוני');
  assert.equal(created.body.category, 'character');
  assert.equal(created.body.description, 'דוב גדול ועדין');
  assert.match(created.body.uid, /^FIG[0-9A-F]{10}$/);

  const deck = await listDeck();
  assert.ok(deck.some((f) => f.uid === created.body.uid), 'new figure should be in the deck');
});

test('two figures created without a uid get different generated uids', async () => {
  const a = await request(app).post('/api/figures').send({ name: 'א', category: 'mood' });
  const b = await request(app).post('/api/figures').send({ name: 'ב', category: 'mood' });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.notEqual(a.body.uid, b.body.uid);
});

test('a figure created through the API can be added to a story', async () => {
  const figure = await request(app)
    .post('/api/figures')
    .send({ name: 'שועל חכם', category: 'character' });

  const story = await request(app).post('/api/stories');
  const added = await request(app)
    .post(`/api/stories/${story.body.id}/figures`)
    .send({ uid: figure.body.uid });

  assert.equal(added.status, 200);
  assert.equal(added.body.recognized, true);
  assert.equal(added.body.duplicate, false);
  assert.equal(added.body.figure.name, 'שועל חכם');
});

test('POST /api/figures with an explicit uid normalizes it and updates the figure if it already exists', async () => {
  const first = await request(app)
    .post('/api/figures')
    .send({ uid: 'bear-01', name: 'דוב', category: 'character' });
  assert.equal(first.status, 201);
  assert.equal(first.body.uid, 'BEAR01');

  const countBefore = (await listDeck()).length;
  const update = await request(app)
    .post('/api/figures')
    .send({ uid: 'BEAR01', name: 'דוב גדול', category: 'object', description: 'עודכן' });
  assert.equal(update.status, 201);
  assert.equal(update.body.uid, 'BEAR01');
  assert.equal(update.body.name, 'דוב גדול');
  assert.equal(update.body.category, 'object');
  assert.equal((await listDeck()).length, countBefore, 'updating must not add a second entry');
});

test('POST /api/figures rejects invalid input', async () => {
  const noName = await request(app).post('/api/figures').send({ category: 'character' });
  assert.equal(noName.status, 400);

  const blankName = await request(app).post('/api/figures').send({ name: '   ', category: 'character' });
  assert.equal(blankName.status, 400);

  const badCategory = await request(app).post('/api/figures').send({ name: 'x', category: 'value' });
  assert.equal(badCategory.status, 400);

  const blankUid = await request(app).post('/api/figures').send({ uid: '  ', name: 'x', category: 'mood' });
  assert.equal(blankUid.status, 400);

  const badDescription = await request(app)
    .post('/api/figures')
    .send({ name: 'x', category: 'mood', description: 5 });
  assert.equal(badDescription.status, 400);
});

test('DELETE /api/figures/:uid removes a figure from the deck, and 404s the second time', async () => {
  const figure = await request(app).post('/api/figures').send({ name: 'זמני', category: 'object' });
  const uid = figure.body.uid;

  const del = await request(app).delete(`/api/figures/${uid}`);
  assert.equal(del.status, 204);
  assert.ok(!(await listDeck()).some((f) => f.uid === uid));

  const delAgain = await request(app).delete(`/api/figures/${uid}`);
  assert.equal(delAgain.status, 404);
});
