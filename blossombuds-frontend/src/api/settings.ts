import http from "./http";

/** Server shapes (adjust if your backend differs) */
export type Setting = {
  id?: number;
  key: string;
  value: string;
  active?: boolean;
  createdBy?: string;
  createdAt?: string;
  modifiedBy?: string;
  modifiedAt?: string;
};

export type SettingDto = {
  key: string;
  value: string;
};

/** Create or update a setting (POST /api/settings) — ADMIN only by your controller */
export async function upsertSetting(dto: SettingDto) {
  const { data } = await http.post<Setting>("/api/settings", dto);
  return data;
}

/** Get a setting entity (GET /api/settings/{key}) */
export async function getSettingEntity(key: string) {
  const { data } = await http.get<Setting>(`/api/settings/${encodeURIComponent(key)}`);
  return data;
}

/** Convenience: get just the string value (or a fallback) */
export async function getSetting<T extends string = string>(key: string, fallback: T | "" = "" as T) {
  try {
    const s = await getSettingEntity(key);
    // Most backends store string values; coerce safely
    return (s?.value ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** List all active settings (GET /api/settings) */
export async function listSettings() {
  const { data } = await http.get<Setting[]>("/api/settings");
  return data;
}

/** Delete a setting by key (DELETE /api/settings/{key}) — ADMIN only */
export async function deleteSetting(key: string) {
  const { data } = await http.delete(`/api/settings/${encodeURIComponent(key)}`);
  return data as { ok?: boolean } | undefined;
}

export default {
  upsertSetting,
  getSettingEntity,
  getSetting,
  listSettings,
  deleteSetting,
};
