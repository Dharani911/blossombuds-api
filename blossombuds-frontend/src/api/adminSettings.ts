// src/api/adminSettings.ts
import { authFetch } from "./authFetch";

export type SettingView = { key: string; value: string };

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await res.text().catch(()=>"HTTP "+res.status));
  return res.json() as Promise<T>;
}

export async function listSettings(): Promise<SettingView[]> {
  return j(await authFetch("/api/settings"));
}
export async function upsertSetting(key: string, value: string) {
  await authFetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}
export async function deleteSetting(key: string) {
  await authFetch(`/api/settings/${encodeURIComponent(key)}`, { method: "DELETE" });
}
