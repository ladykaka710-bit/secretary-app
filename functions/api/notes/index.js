import { json, isNonEmptyString, readJsonBody } from '../../_lib/helpers.js';
import { Store, getKv } from '../../_lib/store.js';

// GET /api/notes
export async function onRequestGet(context) {
  const kv = getKv(context.env);
  const notes = await Store.getNotes(kv);
  notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json(notes);
}

// POST /api/notes
export async function onRequestPost(context) {
  const kv = getKv(context.env);
  const body = await readJsonBody(context.request);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!isNonEmptyString(title)) {
    return json({ error: 'タイトルを入力してください' }, 400);
  }

  const notes = await Store.getNotes(kv);
  const newNote = {
    id: crypto.randomUUID(),
    title,
    content,
    createdAt: new Date().toISOString(),
  };
  notes.push(newNote);
  await Store.saveNotes(kv, notes);
  return json(newNote, 201);
}
