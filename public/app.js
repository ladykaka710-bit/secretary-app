// 秘書アプリ フロントエンド

const noteForm = document.getElementById('note-form');
const noteTitleInput = document.getElementById('note-title');
const noteContentInput = document.getElementById('note-content');
const noteError = document.getElementById('note-error');
const noteList = document.getElementById('note-list');

const taskForm = document.getElementById('task-form');
const taskTitleInput = document.getElementById('task-title');
const taskError = document.getElementById('task-error');
const taskList = document.getElementById('task-list');

const statNotes = document.getElementById('stat-notes');
const statTasks = document.getElementById('stat-tasks');
const statCompleted = document.getElementById('stat-completed');
const statIncomplete = document.getElementById('stat-incomplete');

const reflectionForm = document.getElementById('reflection-form');
const reflectionCommentInput = document.getElementById('reflection-comment');
const reflectionWeekLabel = document.getElementById('reflection-week-label');
const reflectionError = document.getElementById('reflection-error');
const reflectionList = document.getElementById('reflection-list');

const latestReflectionWeek = document.getElementById('latest-reflection-week');
const latestReflectionComment = document.getElementById('latest-reflection-comment');

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "YYYY-MM-DD" 形式の週の開始日・終了日を "M/D 〜 M/D の週" 形式にする
function formatWeekRange(weekStart, weekEnd) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T00:00:00`);
  const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(start)} 〜 ${fmt(end)} の週`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const TRASH_ICON = `
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M5 7h14M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7.5 7l.7 12a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M10.3 10.8v6M13.7 10.8v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>
`;

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'リクエストに失敗しました');
  }
  return data;
}

// ---------- ダッシュボード ----------

async function refreshDashboard() {
  try {
    const stats = await apiRequest('/api/dashboard');
    statNotes.textContent = stats.noteCount;
    statTasks.textContent = stats.taskCount;
    statCompleted.textContent = stats.completedTaskCount;
    statIncomplete.textContent = stats.incompleteTaskCount;
    renderLatestReflection(stats.latestReflection);
  } catch (err) {
    console.error(err);
  }
}

function renderLatestReflection(reflection) {
  if (!reflection) {
    latestReflectionWeek.textContent = 'まだ記録がありません';
    latestReflectionComment.textContent = '週の振り返りを記録すると、ここに最新の内容が表示されます。';
    latestReflectionComment.classList.add('is-empty');
    return;
  }
  latestReflectionComment.classList.remove('is-empty');
  latestReflectionWeek.textContent = formatWeekRange(reflection.weekStart, reflection.weekEnd);
  latestReflectionComment.textContent = reflection.comment;
}

// ---------- メモ ----------

async function loadNotes() {
  try {
    const notes = await apiRequest('/api/notes');
    renderNotes(notes);
  } catch (err) {
    console.error(err);
  }
}

function renderNotes(notes) {
  noteList.innerHTML = '';
  if (notes.length === 0) {
    noteList.innerHTML = '<li class="empty-state">まだメモがありません</li>';
    return;
  }

  for (const note of notes) {
    const li = document.createElement('li');
    li.className = 'note-item';
    li.innerHTML = `
      <div class="note-item__header">
        <span class="note-item__title">${escapeHtml(note.title)}</span>
        <button class="icon-btn" data-action="delete-note" data-id="${note.id}" title="削除">${TRASH_ICON}</button>
      </div>
      ${note.content ? `<p class="note-item__body">${escapeHtml(note.content)}</p>` : ''}
      <div class="note-item__meta">作成日時: ${formatDateTime(note.createdAt)}</div>
    `;
    noteList.appendChild(li);
  }
}

noteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  noteError.textContent = '';
  const title = noteTitleInput.value.trim();
  const content = noteContentInput.value.trim();

  if (!title) {
    noteError.textContent = 'タイトルを入力してください';
    return;
  }

  try {
    await apiRequest('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    });
    noteForm.reset();
    await Promise.all([loadNotes(), refreshDashboard()]);
  } catch (err) {
    noteError.textContent = err.message;
  }
});

noteList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="delete-note"]');
  if (!btn) return;
  const id = btn.dataset.id;
  try {
    await apiRequest(`/api/notes/${id}`, { method: 'DELETE' });
    await Promise.all([loadNotes(), refreshDashboard()]);
  } catch (err) {
    console.error(err);
  }
});

// ---------- タスク ----------

async function loadTasks() {
  try {
    const tasks = await apiRequest('/api/tasks');
    renderTasks(tasks);
  } catch (err) {
    console.error(err);
  }
}

function renderTasks(tasks) {
  taskList.innerHTML = '';
  if (tasks.length === 0) {
    taskList.innerHTML = '<li class="empty-state">まだタスクがありません</li>';
    return;
  }

  for (const task of tasks) {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.innerHTML = `
      <input type="checkbox" data-action="toggle-task" data-id="${task.id}" ${task.completed ? 'checked' : ''} />
      <div class="task-item__body">
        <div class="task-item__title">${escapeHtml(task.title)}</div>
        <div class="task-item__meta">
          <span class="task-item__status ${task.completed ? 'done' : 'pending'}">${task.completed ? '完了' : '未完了'}</span>
          作成日時: ${formatDateTime(task.createdAt)}
        </div>
      </div>
      <button class="icon-btn" data-action="delete-task" data-id="${task.id}" title="削除">${TRASH_ICON}</button>
    `;
    taskList.appendChild(li);
  }
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  taskError.textContent = '';
  const title = taskTitleInput.value.trim();

  if (!title) {
    taskError.textContent = 'タスク内容を入力してください';
    return;
  }

  try {
    await apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
    taskForm.reset();
    await Promise.all([loadTasks(), refreshDashboard()]);
  } catch (err) {
    taskError.textContent = err.message;
  }
});

taskList.addEventListener('change', async (e) => {
  const checkbox = e.target.closest('[data-action="toggle-task"]');
  if (!checkbox) return;
  const id = checkbox.dataset.id;
  try {
    await apiRequest(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: checkbox.checked }),
    });
    await Promise.all([loadTasks(), refreshDashboard()]);
  } catch (err) {
    console.error(err);
  }
});

taskList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="delete-task"]');
  if (!btn) return;
  const id = btn.dataset.id;
  try {
    await apiRequest(`/api/tasks/${id}`, { method: 'DELETE' });
    await Promise.all([loadTasks(), refreshDashboard()]);
  } catch (err) {
    console.error(err);
  }
});

// ---------- 週次振り返り ----------

// 今週分の振り返り（既存の内容があれば読み込み、週の範囲をラベルに反映）
async function loadCurrentReflection() {
  try {
    const current = await apiRequest('/api/reflections/current');
    reflectionWeekLabel.textContent = `今週の振り返り(${formatWeekRange(current.weekStart, current.weekEnd)})`;
    reflectionCommentInput.value = current.comment || '';
  } catch (err) {
    console.error(err);
  }
}

async function loadReflections() {
  try {
    const reflections = await apiRequest('/api/reflections');
    renderReflections(reflections);
  } catch (err) {
    console.error(err);
  }
}

function renderReflections(reflections) {
  reflectionList.innerHTML = '';
  if (reflections.length === 0) {
    reflectionList.innerHTML = '<li class="empty-state">まだ振り返りが記録されていません</li>';
    return;
  }

  for (const reflection of reflections) {
    const li = document.createElement('li');
    li.className = 'reflection-item';
    li.innerHTML = `
      <div class="reflection-item__header">
        <span class="reflection-item__week">${formatWeekRange(reflection.weekStart, reflection.weekEnd)}</span>
        <button class="icon-btn" data-action="delete-reflection" data-id="${reflection.id}" title="削除">${TRASH_ICON}</button>
      </div>
      <p class="reflection-item__body">${escapeHtml(reflection.comment)}</p>
      <div class="reflection-item__meta">更新日時: ${formatDateTime(reflection.updatedAt)}</div>
    `;
    reflectionList.appendChild(li);
  }
}

reflectionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  reflectionError.textContent = '';
  const comment = reflectionCommentInput.value.trim();

  if (!comment) {
    reflectionError.textContent = '振り返りコメントを入力してください';
    return;
  }

  try {
    await apiRequest('/api/reflections', {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
    await Promise.all([loadReflections(), refreshDashboard(), loadCurrentReflection()]);
  } catch (err) {
    reflectionError.textContent = err.message;
  }
});

reflectionList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action="delete-reflection"]');
  if (!btn) return;
  const id = btn.dataset.id;
  try {
    await apiRequest(`/api/reflections/${id}`, { method: 'DELETE' });
    await Promise.all([loadReflections(), refreshDashboard(), loadCurrentReflection()]);
  } catch (err) {
    console.error(err);
  }
});

// ---------- 初期化 ----------

async function init() {
  await Promise.all([
    refreshDashboard(),
    loadNotes(),
    loadTasks(),
    loadReflections(),
    loadCurrentReflection(),
  ]);
}

init();
