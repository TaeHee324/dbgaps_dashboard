const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function get<T>(path: string): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`);

  if (!response.ok) {
    throw new Error(`GET ${normalizedPath} failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
