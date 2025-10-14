import adminHttp, { setAdminToken } from "./adminHttp";

export async function adminLogin(username: string, password: string) {
  const { data } = await adminHttp.post("/api/auth/login", { username, password });
  // expect { token }
  if (data?.token) setAdminToken(data.token);
  return data;
}

export function adminLogout() {
  setAdminToken(null);
}
