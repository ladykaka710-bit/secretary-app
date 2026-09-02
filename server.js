/**
 * 自分専用の秘書アプリ サーバー
 * Node.js 標準モジュールのみで動作（外部パッケージ不要）
 *
 * 起動: node server.js
 * アクセス: http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const REFLECTIONS_FILE = path.join(DATA_DIR, 'reflections.json');

// ---------- データ永続化ヘルパー ----------

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(NOTES_FILE)) fs.writeFileSync(NOTES_FILE, '[]', 'utf-8');
  if (!fs.existsSync(TASKS_FILE)) fs.writeFileSync(TASKS_FILE, '[]', 'utf-8');
  if (!fs.existsSync(REFLECTIONS_FILE)) fs.writeFileSync(REFLECTIONS_FILE, '[]', 'utf-8');
}

function readJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error(`読み込みエラー: ${filePath}`, err);
    return [];
  }
}

function writeJSON(filePath, data) {
  // 一時ファイルに書いてからリネームすることで、書き込み中のクラッシュによる
  // データ破損を防ぐ
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// ---------- リクエストボディ読み取り ----------

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // 極端に大きいリクエストを防ぐ（1MB上限）
      if (body.length > 1_000_000) {
        reject(new Error('リクエストボディが大きすぎます'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('不正なJSON形式です'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------- 静的ファイル配信 ----------

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  let relativePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, relativePath));

  // ディレクトリトラバーサル対策
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- バリデーション ----------

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// ---------- 週の計算ヘルパー（週の開始は月曜日） ----------

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0:日 1:月 ... 6:土
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekEnd(weekStartDate) {
  const d = new Date(weekStartDate);
  d.setDate(d.getDate() + 6);
  return d;
}

function getCurrentWeekRange() {
  const start = getWeekStart(new Date());
  const end = getWeekEnd(start);
  return { weekStart: toDateKey(start), weekEnd: toDateKey(end) };
}

function getLatestReflection(reflections) {
  if (reflections.length === 0) return null;
  return [...reflections].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0];
}

// ---------- APIハンドラ ----------

async function handleApi(req, res, pathname, searchParams) {
  // GET /api/dashboard
  if (pathname === '/api/dashboard' && req.method === 'GET') {
    const notes = readJSON(NOTES_FILE);
    const tasks = readJSON(TASKS_FILE);
    const reflections = readJSON(REFLECTIONS_FILE);
    return sendJSON(res, 200, {
      noteCount: notes.length,
      taskCount: tasks.length,
      incompleteTaskCount: tasks.filter((t) => !t.completed).length,
      latestReflection: getLatestReflection(reflections),
    });
  }

  // GET /api/notes
  if (pathname === '/api/notes' && req.method === 'GET') {
    const notes = readJSON(NOTES_FILE);
    // 新しい順に並べる
    notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJSON(res, 200, notes);
  }

  // POST /api/notes
  if (pathname === '/api/notes' && req.method === 'POST') {
    const body = await readRequestBody(req);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';

    if (!isNonEmptyString(title)) {
      return sendJSON(res, 400, { error: 'タイトルを入力してください' });
    }

    const notes = readJSON(NOTES_FILE);
    const newNote = {
      id: crypto.randomUUID(),
      title,
      content,
      createdAt: new Date().toISOString(),
    };
    notes.push(newNote);
    writeJSON(NOTES_FILE, notes);
    return sendJSON(res, 201, newNote);
  }

  // DELETE /api/notes/:id
  const noteMatch = pathname.match(/^\/api\/notes\/([^/]+)$/);
  if (noteMatch && req.method === 'DELETE') {
    const id = noteMatch[1];
    const notes = readJSON(NOTES_FILE);
    const filtered = notes.filter((n) => n.id !== id);
    if (filtered.length === notes.length) {
      return sendJSON(res, 404, { error: 'メモが見つかりません' });
    }
    writeJSON(NOTES_FILE, filtered);
    return sendJSON(res, 200, { success: true });
  }

  // GET /api/tasks
  if (pathname === '/api/tasks' && req.method === 'GET') {
    const tasks = readJSON(TASKS_FILE);
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJSON(res, 200, tasks);
  }

  // POST /api/tasks
  if (pathname === '/api/tasks' && req.method === 'POST') {
    const body = await readRequestBody(req);
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (!isNonEmptyString(title)) {
      return sendJSON(res, 400, { error: 'タスク内容を入力してください' });
    }

    const tasks = readJSON(TASKS_FILE);
    const newTask = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    writeJSON(TASKS_FILE, tasks);
    return sendJSON(res, 201, newTask);
  }

  // PATCH /api/tasks/:id  (完了状態の切り替え)
  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'PATCH') {
    const id = taskMatch[1];
    const body = await readRequestBody(req);
    const tasks = readJSON(TASKS_FILE);
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return sendJSON(res, 404, { error: 'タスクが見つかりません' });
    }
    task.completed = typeof body.completed === 'boolean' ? body.completed : !task.completed;
    writeJSON(TASKS_FILE, tasks);
    return sendJSON(res, 200, task);
  }

  // DELETE /api/tasks/:id
  if (taskMatch && req.method === 'DELETE') {
    const id = taskMatch[1];
    const tasks = readJSON(TASKS_FILE);
    const filtered = tasks.filter((t) => t.id !== id);
    if (filtered.length === tasks.length) {
      return sendJSON(res, 404, { error: 'タスクが見つかりません' });
    }
    writeJSON(TASKS_FILE, filtered);
    return sendJSON(res, 200, { success: true });
  }

  // GET /api/reflections/current （今週分の振り返りと週の範囲を返す）
  if (pathname === '/api/reflections/current' && req.method === 'GET') {
    const { weekStart, weekEnd } = getCurrentWeekRange();
    const reflections = readJSON(REFLECTIONS_FILE);
    const existing = reflections.find((r) => r.weekStart === weekStart);
    return sendJSON(res, 200, {
      weekStart,
      weekEnd,
      id: existing ? existing.id : null,
      comment: existing ? existing.comment : '',
      updatedAt: existing ? existing.updatedAt : null,
    });
  }

  // GET /api/reflections
  if (pathname === '/api/reflections' && req.method === 'GET') {
    const reflections = readJSON(REFLECTIONS_FILE);
    reflections.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
    return sendJSON(res, 200, reflections);
  }

  // POST /api/reflections （今週の振り返りを記録・更新する。同じ週に対しては上書き）
  if (pathname === '/api/reflections' && req.method === 'POST') {
    const body = await readRequestBody(req);
    const comment = typeof body.comment === 'string' ? body.comment.trim() : '';

    if (!isNonEmptyString(comment)) {
      return sendJSON(res, 400, { error: '振り返りコメントを入力してください' });
    }

    const { weekStart, weekEnd } = getCurrentWeekRange();
    const reflections = readJSON(REFLECTIONS_FILE);
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
    writeJSON(REFLECTIONS_FILE, reflections);
    return sendJSON(res, existing ? 200 : 201, saved);
  }

  // DELETE /api/reflections/:id
  const reflectionMatch = pathname.match(/^\/api\/reflections\/([^/]+)$/);
  if (reflectionMatch && req.method === 'DELETE') {
    const id = reflectionMatch[1];
    const reflections = readJSON(REFLECTIONS_FILE);
    const filtered = reflections.filter((r) => r.id !== id);
    if (filtered.length === reflections.length) {
      return sendJSON(res, 404, { error: '振り返りが見つかりません' });
    }
    writeJSON(REFLECTIONS_FILE, filtered);
    return sendJSON(res, 200, { success: true });
  }

  return sendJSON(res, 404, { error: 'Not Found' });
}

// ---------- サーバー本体 ----------

ensureDataFiles();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname, url.searchParams);
    } else {
      serveStatic(req, res, pathname);
    }
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: 'サーバーエラーが発生しました' });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nポート ${PORT} は既に使用中です。他のプロセスがこのポートを使っていないか確認するか、\n` +
        `PORT=別の番号 node server.js のように別のポートを指定して起動してください。\n`
    );
  } else {
    console.error('サーバーの起動に失敗しました:', err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`秘書アプリが起動しました: http://localhost:${PORT}`);
});
