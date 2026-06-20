import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./app/routes";
import { AuthProvider } from "./app/AuthProvider";
import { CartProvider } from "./app/CartProvider";
import { UIProvider } from "./app/UIState";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AdminAuthProvider } from "./app/AdminAuthProvider";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root div #root not found");

// Remove the inline loading spinner once React hydrates
const initLoader = document.getElementById("bb-init-loader");
if (initLoader) {
  // Small delay so the first paint of the app is visible before we remove the loader
  requestAnimationFrame(() => initLoader.remove());
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
  <BrowserRouter>
  <AdminAuthProvider>
    <AuthProvider>
      <CartProvider>
        <UIProvider>
         <ErrorBoundary>
          <AppRoutes/>
         </ErrorBoundary>
        </UIProvider>
      </CartProvider>
    </AuthProvider>
    </AdminAuthProvider>
   </BrowserRouter>
  </React.StrictMode>
);
