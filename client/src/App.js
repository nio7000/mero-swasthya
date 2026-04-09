import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login             from "./views/Login.jsx";
import Signup            from "./views/Signup.jsx";
import ForgotPassword    from "./views/ForgotPassword.jsx";
import ChangePassword    from "./views/ChangePassword.jsx";
import SetupAccount      from "./views/SetupAccount.jsx";
import DoctorPortal      from "./views/DoctorPortal.jsx";
import PharmacyPortal    from "./views/PharmacyPortal.jsx";
import PharmacyAdminPage from "./views/PharmacyAdminPage.jsx";
import TechnicianPortal  from "./views/TechnicianPortal.jsx";
import AdminPortal       from "./views/AdminPortal.jsx";
import ReceptionistPortal from "./views/ReceptionistPortal.jsx";
import CounterPortal     from "./views/CounterPortal.jsx";
import InvoicePage       from "./views/InvoicePage.jsx";
import ProtectedRoute    from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"                element={<Login />} />
        <Route path="/register"        element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/setup-account"   element={<SetupAccount />} />

        <Route path="/doctorportal"  element={<ProtectedRoute element={<DoctorPortal />} />} />
        <Route path="/pharmacy"      element={<ProtectedRoute element={<PharmacyPortal />} />} />
        <Route path="/pharmacy-admin" element={<ProtectedRoute element={<PharmacyAdminPage />} />} />
        <Route path="/dashboard"     element={<ProtectedRoute element={<TechnicianPortal />} />} />
        <Route path="/receptionist"  element={<ProtectedRoute element={<ReceptionistPortal />} />} />
        <Route path="/counter"       element={<ProtectedRoute element={<CounterPortal />} />} />
        <Route path="/invoice"       element={<ProtectedRoute element={<InvoicePage />} />} />
        <Route path="/admin"         element={<ProtectedRoute element={<AdminPortal />} />} />

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
