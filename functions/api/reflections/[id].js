import { json } from '../../_lib/helpers.js';
import { Store, getKv } from '../../_lib/store.js';

// DELETE /api/reflections/:id
export async function onRequestDelete(context) {
  const kv = getKv(context.env);
  const { id } = context.params;
  const reflections = await Store.getReflections(kv);
  const filtered = reflections.filter((r) => r.id !== id);

  if (filtered.length === reflections.length) {
    return json({ error: '振り返りが見つかりません' }, 404);
  }

  await Store.saveReflections(kv, filtered);
  return json({ success: true });
}
