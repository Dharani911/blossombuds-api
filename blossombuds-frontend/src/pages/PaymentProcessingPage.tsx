import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import http from "../api/http";
import { useCart } from "../app/CartProvider";

export default function PaymentProcessingPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { clear } = useCart();
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(true);
    const STORAGE_KEY = "rzp_last_success";

    function readStoredPayload() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }

    useEffect(() => {
        let razorpayOrderId = searchParams.get("razorpay_order_id");
        let razorpayPaymentId = searchParams.get("razorpay_payment_id");
        let razorpaySignature = searchParams.get("razorpay_signature");
        let currency = searchParams.get("currency") || "INR";

        // ✅ Fallback: if URL missing (refresh / navigation issue), try sessionStorage
        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
          const stored = readStoredPayload();
          if (stored) {
            razorpayOrderId = stored.razorpay_order_id || stored.razorpayOrderId || razorpayOrderId;
            razorpayPaymentId = stored.razorpay_payment_id || stored.razorpayPaymentId || razorpayPaymentId;
            razorpaySignature = stored.razorpay_signature || stored.razorpaySignature || razorpaySignature;
            currency = stored.currency || currency;
          }
        }

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
          setError("Invalid payment data. Please contact support.");
          setProcessing(false);
          return;
        }


        // Prevent navigation away
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
            return "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        // Verify payment and create order
        (async () => {
            try {
                await http.post("/api/payments/razorpay/verify", {
                  razorpayOrderId,
                  razorpayPaymentId,
                  razorpaySignature,
                  currency,
                });


                // ✅ show success UI state
                setError(null);
                setProcessing(false);

                // ✅ clear cart
                clear();

                // ✅ remove stored payload (optional)
                sessionStorage.removeItem(STORAGE_KEY);

                // Remove the beforeunload listener before navigating
                window.removeEventListener("beforeunload", handleBeforeUnload);

                // Wait a moment to show success state
                setTimeout(() => {
                  navigate("/", { replace: true });
                }, 2000);

            } catch (e: any) {
                console.error("Payment verification failed:", e);
                setError(
                    e?.response?.data?.message ||
                    "Payment was successful but order creation failed. Please contact support with your payment details."
                );
                setProcessing(false);
                window.removeEventListener("beforeunload", handleBeforeUnload);
            }
        })();

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [searchParams, navigate, clear]);

    // Prevent back button
    useEffect(() => {
        if (!processing && !error) return;

        const preventBackButton = () => {
            window.history.pushState(null, "", window.location.href);
        };

        window.history.pushState(null, "", window.location.href);
        window.addEventListener("popstate", preventBackButton);

        return () => {
            window.removeEventListener("popstate", preventBackButton);
        };
    }, [processing, error]);

    return (
        <div style={styles.container}>
            <style>{css}</style>
            <div style={styles.card}>
                {processing ? (
                    <>
                        <div style={styles.spinner}>
                            <div style={styles.spinnerCircle}></div>
                        </div>
                        <h1 style={styles.title}>Processing Your Payment</h1>
                        <div style={styles.warningBox}>
                            <svg
                                style={styles.warningIcon}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                />
                            </svg>
                            <p style={styles.warningTitle}>⚠️ Important - Please Wait!</p>
                            <ul style={styles.warningList}>
                                <li>❌ DO NOT refresh this page</li>
                                <li>❌ DO NOT press the back button</li>
                                <li>❌ DO NOT close this tab or browser</li>
                            </ul>
                        </div>
                        <p style={styles.message}>
                            Your payment was successful! We are now creating your order...
                        </p>
                        <p style={styles.submessage}>This will only take a few seconds.</p>
                    </>
                ) : error ? (
                    <>
                        <div style={styles.errorIcon}>
                            <svg fill="currentColor" viewBox="0 0 20 20" width="64" height="64">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <h1 style={styles.errorTitle}>Order Creation Failed</h1>
                        <p style={styles.errorMessage}>{error}</p>
                        <button style={styles.button} onClick={() => navigate("/")}>
                            Return Home
                        </button>
                    </>
                ) : (
                    <>
                        <div style={styles.successIcon}>
                            <svg fill="currentColor" viewBox="0 0 20 20" width="64" height="64">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <h1 style={styles.successTitle}>Order Created Successfully!</h1>
                        <p style={styles.successMessage}>Redirecting you to the home page...</p>
                    </>
                )}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb",
        padding: "1rem",
    },
    card: {
        backgroundColor: "white",
        borderRadius: "1rem",
        padding: "3rem 2rem",
        maxWidth: "500px",
        width: "100%",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
        textAlign: "center",
    },
    spinner: {
        display: "flex",
        justifyContent: "center",
        marginBottom: "2rem",
    },
    spinnerCircle: {
        width: "64px",
        height: "64px",
        border: "4px solid #f3f4f6",
        borderTop: "4px solid #F05D8B",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
    },
    title: {
        fontSize: "1.875rem",
        fontWeight: "bold",
        color: "#111827",
        marginBottom: "1.5rem",
    },
    warningBox: {
        backgroundColor: "#fef3c7",
        border: "2px solid #fbbf24",
        borderRadius: "0.5rem",
        padding: "1.5rem",
        marginBottom: "1.5rem",
    },
    warningIcon: {
        width: "48px",
        height: "48px",
        color: "#d97706",
        margin: "0 auto 1rem",
    },
    warningTitle: {
        fontSize: "1.125rem",
        fontWeight: "600",
        color: "#92400e",
        marginBottom: "1rem",
    },
    warningList: {
        textAlign: "left",
        listStyle: "none",
        padding: 0,
        margin: 0,
        color: "#78350f",
        fontSize: "0.875rem",
        lineHeight: "1.75",
    },
    message: {
        fontSize: "1rem",
        color: "#4b5563",
        marginBottom: "0.5rem",
    },
    submessage: {
        fontSize: "0.875rem",
        color: "#9ca3af",
    },
    errorIcon: {
        color: "#dc2626",
        marginBottom: "1rem",
    },
    errorTitle: {
        fontSize: "1.875rem",
        fontWeight: "bold",
        color: "#dc2626",
        marginBottom: "1rem",
    },
    errorMessage: {
        fontSize: "1rem",
        color: "#4b5563",
        marginBottom: "1.5rem",
        lineHeight: "1.5",
    },
    successIcon: {
        color: "#10b981",
        marginBottom: "1rem",
    },
    successTitle: {
        fontSize: "1.875rem",
        fontWeight: "bold",
        color: "#10b981",
        marginBottom: "1rem",
    },
    successMessage: {
        fontSize: "1rem",
        color: "#4b5563",
    },
    button: {
        backgroundColor: "#F05D8B",
        color: "white",
        padding: "0.75rem 2rem",
        borderRadius: "0.5rem",
        border: "none",
        fontSize: "1rem",
        fontWeight: "500",
        cursor: "pointer",
        transition: "background-color 0.2s",
    },
};

const css = `
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

button:hover {
  background-color: #e04c78 !important;
}
`;
