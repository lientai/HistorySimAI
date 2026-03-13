const cache = new Map();

export async function loadJSON(path) {
  if (cache.has(path)) {
    return cache.get(path);
  }
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`加载 JSON 失败: ${path} (${res.status})`);
  }
  const data = await res.json();
  cache.set(path, data);
  return data;
}
