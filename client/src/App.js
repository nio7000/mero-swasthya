// Root router — maps URL paths to portal views.
// ProtectedRoute handles role-based access so users can't manually navigate to other portals.
// getPortal() checks the stored JWT and redirects logged-in users away from public pages.

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Login              from "./views/Login.jsx";
import Signup             from "./views/Signup.jsx";
import ForgotPassword     from "./views/ForgotPassword.jsx";
import ChangePassword     from "./views/ChangePassword.jsx";
import SetupAccount       from "./views/SetupAccount.jsx";
import DoctorPortal       from "./views/DoctorPortal.jsx";
import PharmacyPortal     from "./views/PharmacyPortal.jsx";
import PharmacyAdminPage  from "./views/PharmacyAdminPage.jsx";
import TechnicianPortal   from "./views/TechnicianPortal.jsx";
import AdminPortal        from "./views/AdminPortal.jsx";
import ReceptionistPortal from "./views/ReceptionistPortal.jsx";
import CounterPortal      from "./views/CounterPortal.jsx";
import InvoicePage        from "./views/InvoicePage.jsx";
import ProtectedRoute     from "./components/ProtectedRoute.jsx";
import { STORAGE_KEYS, ROLE_ROUTES } from "./constants";


// Returns the logged-in user's portal path, or null if not authenticated / token expired.
// Decodes the JWT payload to check expiry without making a network call.
function getPortal() {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const role  = localStorage.getItem(STORAGE_KEYS.ROLE);
  if (!token || !role) return null;
  try {
    const { exp } = JSON.parse(atob(token.split(".")[1]));
    if (exp && Date.now() / 1000 > exp) {
      localStorage.clear();  // expired — wipe everything and send to login
      return null;
    }
  } catch {
    localStorage.clear();
    return null;
  }
  return ROLE_ROUTES[role] || null;
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/"         element={<Login />} />
        <Route path="/register" element={<Signup />} />

        {/* Only accessible when NOT logged in — redirect to portal if already authenticated */}
        <Route path="/forgot-password" element={
          (() => { const p = getPortal(); return p ? <Navigate to={p} replace /> : <ForgotPassword />; })()
        } />
        <Route path="/setup-account" element={
          (() => { const p = getPortal(); return p ? <Navigate to={p} replace /> : <SetupAccount />; })()
        } />

        {/* Change-password screen — only shown when must_change_password flag is set */}
        <Route path="/change-password" element={
          (() => {
            const p = getPortal();
            if (!p) return <Navigate to="/" replace />;
            if (!localStorage.getItem("mustChangePassword")) return <Navigate to={p} replace />;
            return <ChangePassword />;
          })()
        } />

        {/* Protected portal routes — ProtectedRoute verifies the role before rendering */}
        <Route path="/doctorportal"   element={<ProtectedRoute element={<DoctorPortal />} />} />
        <Route path="/pharmacy"       element={<ProtectedRoute element={<PharmacyPortal />} />} />
        <Route path="/pharmacy-admin" element={<ProtectedRoute element={<PharmacyAdminPage />} />} />
        <Route path="/dashboard"      element={<ProtectedRoute element={<TechnicianPortal />} />} />
        <Route path="/receptionist"   element={<ProtectedRoute element={<ReceptionistPortal />} />} />
        <Route path="/counter"        element={<ProtectedRoute element={<CounterPortal />} />} />
        <Route path="/invoice"        element={<ProtectedRoute element={<InvoicePage />} />} />
        <Route path="/admin"          element={<ProtectedRoute element={<AdminPortal />} />} />

        {/* Catch-all for unknown routes */}
        <Route path="*" element={
          <div style={{ textAlign: "center", marginTop: "20vh", fontFamily: "var(--font)" }}>
            <h2>404 - Page Not Found</h2>
            <p>The page you're looking for doesn't exist.</p>
            <a href="/" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: "600" }}>
              ← Go back to Login
            </a>
          </div>
        } />
      </Routes>
    </Router>
  );
}
