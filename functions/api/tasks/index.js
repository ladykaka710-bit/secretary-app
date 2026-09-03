import { json, isNonEmptyString, readJsonBody } from '../../_lib/helpers.js';
import { Store, getKv } from '../../_lib/store.js';

// GET /api/tasks
export async function onRequestGet(context) {
  const kv = getKv(context.env);
  const tasks = await Store.getTasks(kv);
  tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json(tasks);
}

// POST /api/tasks
export async function onRequestPost(context) {
  const kv = getKv(context.env);
  const body = await readJsonBody(context.request);
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!isNonEmptyString(title)) {
    return json({ error: 'タスク内容を入力してください' }, 400);
  }

  const tasks = await Store.getTasks(kv);
  const newTask = {
    id: crypto.randomUUID(),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  tasks.push(newTask);
  await Store.saveTasks(kv, tasks);
  return json(newTask, 201);
}
