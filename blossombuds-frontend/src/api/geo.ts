// src/api/geo.ts
import http from "./http";

/** API models (adjust if your backend returns different fields) */
export type Country = { id: number; name: string; isoCode?: string };
export type State = { id: number; name: string; countryId?: number };
export type District = { id: number; name: string; stateId?: number };

/** GET /api/locations/countries */
export async function getCountries() {
  const { data } = await http.get<Country[]>("/api/locations/countries");
  return data;
}

/** GET /api/locations/states/{countryId} */
export async function getStatesByCountry(countryId: number) {
  const { data } = await http.get<State[]>(`/api/locations/states/${countryId}`);
  return data;
}

/** GET /api/locations/districts/{stateId} */
export async function getDistrictsByState(stateId: number) {
  const { data } = await http.get<District[]>(`/api/locations/districts/${stateId}`);
  return data;
}

/** Convenience (if you ever need the full lists) */
export async function getAllStates() {
  const { data } = await http.get<State[]>("/api/locations/states");
  return data;
}
export async function getAllDistricts() {
  const { data } = await http.get<District[]>("/api/locations/districts");
  return data;
}

export default {
  getCountries,
  getStatesByCountry,
  getDistrictsByState,
  getAllStates,
  getAllDistricts,
};
