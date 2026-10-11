import fs from 'fs';
import { randomUUID } from 'crypto';
import config from '../config';
import db from '../data/db';
import logger from '../logger';
import { normalizeUid } from '../utils/uid';
import { Category, Figure } from '../types';

interface FigureRow {
  uid: string;
  name: string;
  category: Category;
  description: string;
}

const countStmt = db.prepare('SELECT COUNT(*) as count FROM figures');
const upsertStmt = db.prepare(`
  INSERT INTO figures (uid, name, category, description, created_at)
  VALUES (@uid, @name, @category, @description, @createdAt)
  ON CONFLICT(uid) DO UPDATE SET name = excluded.name, category = excluded.category, description = excluded.description
`);
const getStmt = db.prepare('SELECT uid, name, category, description FROM figures WHERE uid = ?');
const listStmt = db.prepare('SELECT uid, name, category, description FROM figures ORDER BY created_at ASC');
const deleteStmt = db.prepare('DELETE FROM figures WHERE uid = ?');
const wasSeededStmt = db.prepare('SELECT uid FROM seeded_figures WHERE uid = ?');
const seededCountStmt = db.prepare('SELECT COUNT(*) as count FROM seeded_figures');
const markSeededStmt = db.prepare(
  'INSERT OR IGNORE INTO seeded_figures (uid, seeded_at) VALUES (@uid, @seededAt)'
);

// Seed from the bundled starter deck (server/src/data/figures.json). The DB stays the source of
// truth - figures added through the UI survive redeploys - but a uid the deck has never
// seeded into this DB is new, and gets added on boot so extending the deck actually reaches a
// server that was seeded long ago. Anything already seeded is left alone, so a figure edited or
// deleted through the UI is not resurrected or overwritten on the next restart.
function seedNewFromStarterDeck(): void {
  const raw = fs.readFileSync(config.figuresPath, 'utf8');
  const parsed: Record<string, { name: string; category: Category; description: string }> = JSON.parse(raw);
  const seededAt = new Date().toISOString();

  // a db seeded before this table existed has the whole deck in `figures` and nothing recorded
  // here; treat what it already holds as seeded so the first boot after the upgrade is a no-op
  const backfill = countStmt.get() as { count: number };
  if (backfill.count > 0 && (seededCountStmt.get() as { count: number }).count === 0) {
    const markExisting = db.transaction(() => {
      for (const uid of Object.keys(parsed)) {
        const normalized = normalizeUid(uid);
        if (getStmt.get(normalized)) markSeededStmt.run({ uid: normalized, seededAt });
      }
    });
    markExisting();
  }

  const added: string[] = [];
  const insertNew = db.transaction(() => {
    for (const [uid, figure] of Object.entries(parsed)) {
      const normalized = normalizeUid(uid);
      if (wasSeededStmt.get(normalized)) continue;
      upsertStmt.run({
        uid: normalized,
        name: figure.name,
        category: figure.category,
        description: figure.description,
        createdAt: seededAt,
      });
      markSeededStmt.run({ uid: normalized, seededAt });
      added.push(figure.name);
    }
  });
  insertNew();

  if (added.length > 0) {
    logger.info({ count: added.length, figures: added }, 'new starter-deck figures added');
  }
}

seedNewFromStarterDeck();

export function resolveFigure(rawUid: string): Figure | null {
  const uid = normalizeUid(rawUid);
  const row = getStmt.get(uid) as FigureRow | undefined;
  return row ? { ...row } : null;
}

export function listFigures(): Figure[] {
  return listStmt.all() as Figure[];
}

export interface CreateFigureInput {
  // optional: a figure created without one gets a generated id. Passing an existing uid
  // updates that figure instead of creating a new one.
  uid?: string;
  name: string;
  category: Category;
  description?: string;
}

function generateUid(): string {
  let uid: string;
  do {
    uid = `FIG${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  } while (getStmt.get(uid));
  return uid;
}

export function createFigure(input: CreateFigureInput): Figure {
  const uid = (input.uid && normalizeUid(input.uid)) || generateUid();
  upsertStmt.run({
    uid,
    name: input.name.trim(),
    category: input.category,
    description: (input.description || '').trim(),
    createdAt: new Date().toISOString(),
  });
  logger.info({ uid, figureName: input.name, category: input.category }, 'figure saved');
  return resolveFigure(uid) as Figure;
}

export function deleteFigure(rawUid: string): boolean {
  const uid = normalizeUid(rawUid);
  const result = deleteStmt.run(uid);
  const removed = result.changes > 0;
  logger.info({ uid, removed }, 'figure deleted');
  return removed;
}
