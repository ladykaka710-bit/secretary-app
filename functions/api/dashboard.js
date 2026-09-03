import { json, getLatestReflection } from '../_lib/helpers.js';
import { Store, getKv } from '../_lib/store.js';

export async function onRequestGet(context) {
  const kv = getKv(context.env);
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
