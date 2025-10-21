// src/api/adminSettings.ts
import adminHttp from "./adminHttp";

export type SettingView = { key: string; value: string };

export async function listSettings(): Promise<SettingView[]> {
  const { data } = await adminHttp.get<SettingView[]>("/api/settings");
  return data;
}

export async function upsertSetting(key: string, value: string) {
  await adminHttp.post("/api/settings", { key, value });
}

export async function deleteSetting(key: string) {
  await adminHttp.delete(`/api/settings/${encodeURIComponent(key)}`);
}
