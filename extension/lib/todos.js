const STORAGE_PREFIX = "compass_todos_";

function storageKey(projectId) {
  return `${STORAGE_PREFIX}${projectId}`;
}

export async function loadTodos(projectId) {
  const key = storageKey(projectId);
  const data = await browser.storage.local.get(key);
  return data[key] || [];
}

export async function saveTodos(projectId, todos) {
  await browser.storage.local.set({ [storageKey(projectId)]: todos });
}

export function createTodo(text) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    done: false,
    createdAt: new Date().toISOString(),
  };
}
