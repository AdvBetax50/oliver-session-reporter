// Cliente HTTP mínimo. En desarrollo Vite redirige /api al servidor Express.
export async function apiGet(path) {
  const res = await fetch(`/api${path}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
  return body;
}
