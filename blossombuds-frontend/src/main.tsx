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
