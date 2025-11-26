import React from "react";
import {
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";

import AppLayout from "./shells/AppLayout";
import HomePage from "../pages/HomePage";
import CartPage from "../pages/CartPage";
import ProfilePage from "../pages/ProfilePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import VerifyPage from "../pages/VerifyPage";
import ShopCategoriesPage from "../pages/ShopCategoriesPage";
import FeaturedPage from "../pages/FeaturedPage";
import CheckoutPage from "../pages/CheckoutPage"
import CustomerReviewsPage from "../pages/ReviewsPage";
import CmsPage from "../pages/CmsPage";
import PoliciesIndexPage from "../pages/PoliciesIndexPage";
import PolicyPage from "../pages/PolicyPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import ContactPage from "./pages/ContactPage";



import AdminGuard from "./AdminGuard";
import AdminLoginPage from "../pages/admin/AdminLoginPage";
import AdminDashboardPage from "../pages/admin/AdminDashboardPage";
import AdminLayout from "../pages/admin/AdminLayout";
import ProductsPage from "../pages/admin/ProductsPage";
import CategoriesPage from "../pages/admin/CategoriesPage";
import OrdersPage from "../pages/admin/OrdersPage";
import AdminReviewsPage from "../pages/admin/ReviewsPage";
import SettingsPage from "../pages/admin/SettingsPage";
import CustomersPage from "../pages/admin/CustomersPage";
import CreateOrderPageAdmin from "../pages/admin/CreateOrderPage";



export default function AppRoutes() {
  const location = useLocation();
  const state = location.state as { background?: Location } | undefined;
  const background = state?.background;

  return (
    <>
      {/* Main content. If a modal is open, render the background location here */}
      <Routes location={background || location}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/categories" element={<ShopCategoriesPage />} />
          <Route path="/categories/:id" element={<ShopCategoriesPage />} />
          <Route path="/featured" element={<FeaturedPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/reviews" element={<CustomerReviewsPage />} />
          <Route path="/pages/:slug" element={<CmsPage />} />
          <Route path="/policies" element={<PoliciesIndexPage />} />
          <Route path="/policies/:slug" element={<PolicyPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/contact" element={<ContactPage />} />


          {/* Email verification routes (support both forms if you use both) */}
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/verify-email" element={<VerifyPage />} />

          {/* If user directly visits /login or /register (no background), send them home */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />

          <Route path="*" element={<div style={{ padding: 24 }}>Not found</div>} />
        </Route>
        {/* ---------- Admin routes (not modal) ---------- */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminGuard />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />  {/* Analytics (default) */}
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/new" element={<CreateOrderPageAdmin />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="customers" element={<CustomersPage />} />
          </Route>
        </Route>

      </Routes>

      {/* Modal routes (rendered on top) — ONLY when opened from another page */}
      {background && (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      )}
    </>
  );
}