const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
export async function api<T = any>(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}
export const apiBase = API;
