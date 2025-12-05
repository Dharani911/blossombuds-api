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
        navigate("/login?error=oauth2_failed", { replace: true });
        return;
      }

      try {
        loginWithToken(token);
        navigate("/profile", { replace: true });
      } catch (e) {
        console.error("[OAUTH2] loginWithToken failed", e);
        navigate("/login?error=oauth2_failed", { replace: true });
      }
    }, [searchParams, loginWithToken, navigate]);


    return (
        <div className="flex items-center justify-center min-h-screen">
            <p>Logging you in...</p>
        </div>
    );
}
