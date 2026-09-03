// Cloudflare Workers 用エントリーポイント
// /api/* は自前でルーティングし、それ以外は静的アセット（public/）を配信する

import {
  json,
  isNonEmptyString,
  readJsonBody,
  getCurrentWeekRange,
  getLatestReflection,
} from './lib/helpers.js';
import { Store, getKv } from './lib/store.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, pathname);
      } catch (err) {
        console.error(err);
        return json({ error: 'サーバーエラーが発生しました' }, 500);
      }
    }

    // メモ・タスク・振り返り画面（HTML/CSS/JS）は静的アセットとして配信
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, pathname) {
  const kv = getKv(env);
  const method = request.method;

  // GET /api/dashboard
  if (pathname === '/api/dashboard' && method === 'GET') {
    const [notes, tasks, reflections] = await Promise.all([
      Store.getNotes(kv),
      Store.getTasks(kv),
      Store.getReflections(kv),
    ]);
    return json({
      noteCount: notes.length,
      taskCount: tasks.length,
      completedTaskCount: tasks.filter((t) => t.completed).length,
      latestReflection: getLatestReflection(reflections),
    });
  }

  // GET /api/notes
  if (pathname === '/api/notes' && method === 'GET') {
    const notes = await Store.getNotes(kv);
    notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json(notes);
  }

  // POST /api/notes
  if (pathname === '/api/notes' && method === 'POST') {
    const body = await readJsonBody(request);
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

  // DELETE /api/notes/:id
  const noteMatch = pathname.match(/^\/api\/notes\/([^/]+)$/);
  if (noteMatch && method === 'DELETE') {
    const id = noteMatch[1];
    const notes = await Store.getNotes(kv);
    const filtered = notes.filter((n) => n.id !== id);
    if (filtered.length === notes.length) {
      return json({ error: 'メモが見つかりません' }, 404);
    }
    await Store.saveNotes(kv, filtered);
    return json({ success: true });
  }

  // GET /api/tasks
  if (pathname === '/api/tasks' && method === 'GET') {
    const tasks = await Store.getTasks(kv);
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json(tasks);
  }

  // POST /api/tasks
  if (pathname === '/api/tasks' && method === 'POST') {
    const body = await readJsonBody(request);
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

  // PATCH /api/tasks/:id （完了状態の切り替え）
  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && method === 'PATCH') {
    const id = taskMatch[1];
    const body = await readJsonBody(request);
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
  if (taskMatch && method === 'DELETE') {
    const id = taskMatch[1];
    const tasks = await Store.getTasks(kv);
    const filtered = tasks.filter((t) => t.id !== id);
    if (filtered.length === tasks.length) {
      return json({ error: 'タスクが見つかりません' }, 404);
    }
    await Store.saveTasks(kv, filtered);
    return json({ success: true });
  }

  // GET /api/reflections/current （今週分の振り返りと週の範囲を返す）
  if (pathname === '/api/reflections/current' && method === 'GET') {
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

  // GET /api/reflections
  if (pathname === '/api/reflections' && method === 'GET') {
    const reflections = await Store.getReflections(kv);
    reflections.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
    return json(reflections);
  }

  // POST /api/reflections （今週の振り返りを記録・更新する。同じ週に対しては上書き）
  if (pathname === '/api/reflections' && method === 'POST') {
    const body = await readJsonBody(request);
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

  // DELETE /api/reflections/:id
  const reflectionMatch = pathname.match(/^\/api\/reflections\/([^/]+)$/);
  if (reflectionMatch && method === 'DELETE') {
    const id = reflectionMatch[1];
    const reflections = await Store.getReflections(kv);
    const filtered = reflections.filter((r) => r.id !== id);
    if (filtered.length === reflections.length) {
      return json({ error: '振り返りが見つかりません' }, 404);
    }
    await Store.saveReflections(kv, filtered);
    return json({ success: true });
  }

  return json({ error: 'Not Found' }, 404);
}
