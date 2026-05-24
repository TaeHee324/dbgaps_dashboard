const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function get<T>(path: string): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`);

  if (!response.ok) {
    throw new Error(`GET ${normalizedPath} failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${normalizedPath} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function del(path: string): Promise<void> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE_URL}${normalizedPath}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204)
    throw new Error(`DELETE ${normalizedPath} failed: ${res.status}`);
}

export async function put<T>(path: string, body: unknown): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${normalizedPath} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
