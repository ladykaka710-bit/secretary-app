import { json, isNonEmptyString, readJsonBody, getCurrentWeekRange } from '../../_lib/helpers.js';
import { Store, getKv } from '../../_lib/store.js';

// GET /api/reflections
export async function onRequestGet(context) {
  const kv = getKv(context.env);
  const reflections = await Store.getReflections(kv);
  reflections.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  return json(reflections);
}

// POST /api/reflections （今週の振り返りを記録・更新する。同じ週に対しては上書き）
export async function onRequestPost(context) {
  const kv = getKv(context.env);
  const body = await readJsonBody(context.request);
  const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

  if (!isNonEmptyString(comment)) {
    return json({ error: '振り返りコメントを入力してください' }, 400);
  }

  const { weekStart, weekEnd } = getCurrentWeekRange();
  const reflections = await Store.getReflections(kv);
  const now = new Date().toISOString();
  const existing = reflections.find((r) => r.weekStart === weekStart);

  let saved;
  if (existing) {
    existing.comment = comment;
    existing.updatedAt = now;
    saved = existing;
  } else {
    saved = {
      id: crypto.randomUUID(),
      weekStart,
      weekEnd,
      comment,
      createdAt: now,
      updatedAt: now,
    };
    reflections.push(saved);
  }

  await Store.saveReflections(kv, reflections);
  return json(saved, existing ? 200 : 201);
}
