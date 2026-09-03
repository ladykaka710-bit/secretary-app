// Cloudflare KV を使ったデータ永続化ヘルパー
// notes / tasks / reflections をそれぞれ1つのJSON配列としてKVに保存する

const KEYS = {
  notes: 'notes',
  tasks: 'tasks',
  reflections: 'reflections',
};

async function getList(kv, key) {
  const data = await kv.get(key, 'json');
  return Array.isArray(data) ? data : [];
}

async function saveList(kv, key, list) {
  await kv.put(key, JSON.stringify(list));
}

export const Store = {
  getNotes: (kv) => getList(kv, KEYS.notes),
  saveNotes: (kv, list) => saveList(kv, KEYS.notes, list),
  getTasks: (kv) => getList(kv, KEYS.tasks),
  saveTasks: (kv, list) => saveList(kv, KEYS.tasks, list),
  getReflections: (kv) => getList(kv, KEYS.reflections),
  saveReflections: (kv, list) => saveList(kv, KEYS.reflections, list),
};

// Pages プロジェクトの Settings > Functions > KV namespace bindings で
// この名前（SECRETARY_KV）でバインドしてください
export function getKv(env) {
  if (!env.SECRETARY_KV) {
    throw new Error(
      'KVバインディング "SECRETARY_KV" が見つかりません。CloudflareダッシュボードのPagesプロジェクト設定でKV namespaceをバインドしてください。'
    );
  }
  return env.SECRETARY_KV;
}
