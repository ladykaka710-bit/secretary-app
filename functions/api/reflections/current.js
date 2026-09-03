import { json, getCurrentWeekRange } from '../../_lib/helpers.js';
import { Store, getKv } from '../../_lib/store.js';

// GET /api/reflections/current （今週分の振り返りと週の範囲を返す）
export async function onRequestGet(context) {
  const kv = getKv(context.env);
  const { weekStart, weekEnd } = getCurrentWeekRange();
  const reflections = await Store.getReflections(kv);
  const existing = reflections.find((r) => r.weekStart === weekStart);

  return json({
    weekStart,
    weekEnd,
    id: existing ? existing.id : null,
    comment: existing ? existing.comment : '',
    updatedAt: existing ? existing.updatedAt : null,
  });
}
