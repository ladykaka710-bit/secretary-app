// Cloudflare Pages Functions 共通ヘルパー
// server.js（ローカルNode版）と同じロジックを Workers ランタイム向けに移植したもの

export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// 週の開始日（月曜日）を返す
export function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0:日 1:月 ... 6:土
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekEnd(weekStartDate) {
  const d = new Date(weekStartDate);
  d.setDate(d.getDate() + 6);
  return d;
}

export function getCurrentWeekRange() {
  const start = getWeekStart(new Date());
  const end = getWeekEnd(start);
  return { weekStart: toDateKey(start), weekEnd: toDateKey(end) };
}

export function getLatestReflection(reflections) {
  if (reflections.length === 0) return null;
  return [...reflections].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0];
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
