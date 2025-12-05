import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/AuthProvider";

export default function OAuth2RedirectHandler() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { loginWithToken } = useAuth();

    useEffect(() => {
      const token = searchParams.get("token");
      console.log("[OAUTH2] token from URL =", token);

      if (!token) {
        // Hard redirect to login with error
        window.location.replace("/login?error=oauth2_failed");
        return;
      }

      try {
        // Store token in auth context/localStorage
        loginWithToken(token);

        // Hard redirect to profile to avoid any router nesting / modal background issues
        window.location.replace("/profile");
      } catch (e) {
        console.error("[OAUTH2] loginWithToken failed", e);
        window.location.replace("/login?error=oauth2_failed");
      }
      // We intentionally want this to run once on mount
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);



    return (
        <div className="flex items-center justify-center min-h-screen">
            <p>Logging you in...</p>
        </div>
    );
}
