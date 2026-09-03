import { json } from '../../_lib/helpers.js';
import { Store, getKv } from '../../_lib/store.js';

// DELETE /api/notes/:id
export async function onRequestDelete(context) {
  const kv = getKv(context.env);
  const { id } = context.params;
  const notes = await Store.getNotes(kv);
  const filtered = notes.filter((n) => n.id !== id);

  if (filtered.length === notes.length) {
    return json({ error: 'メモが見つかりません' }, 404);
  }

  await Store.saveNotes(kv, filtered);
  return json({ success: true });
}
