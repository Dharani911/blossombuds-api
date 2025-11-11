// src/api/authReset.ts
import http from "./http";

export async function requestPasswordReset(email: string) {
  // Always return success to the UI (privacy); let server decide.
  await http.post("/api/customers/auth/password-reset/request", { email: email.trim() });
}

export async function confirmPasswordReset(token: string, newPassword: string) {
  await http.post("/api/customers/auth/password-reset/confirm", {
    token: token.trim(),
    newPassword,
  });
}
