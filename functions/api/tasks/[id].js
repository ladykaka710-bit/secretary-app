import { json, readJsonBody } from '../../_lib/helpers.js';
import { Store, getKv } from '../../_lib/store.js';

// PATCH /api/tasks/:id （完了状態の切り替え）
export async function onRequestPatch(context) {
  const kv = getKv(context.env);
  const { id } = context.params;
  const body = await readJsonBody(context.request);
  const tasks = await Store.getTasks(kv);
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return json({ error: 'タスクが見つかりません' }, 404);
  }

  task.completed = typeof body.completed === 'boolean' ? body.completed : !task.completed;
  await Store.saveTasks(kv, tasks);
  return json(task);
}

// DELETE /api/tasks/:id
export async function onRequestDelete(context) {
  const kv = getKv(context.env);
  const { id } = context.params;
  const tasks = await Store.getTasks(kv);
  const filtered = tasks.filter((t) => t.id !== id);

  if (filtered.length === tasks.length) {
    return json({ error: 'タスクが見つかりません' }, 404);
  }

  await Store.saveTasks(kv, filtered);
  return json({ success: true });
}
