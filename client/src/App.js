import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login.jsx";
import DoctorPortal from "./pages/DoctorPortal.jsx";
import PharmacyPortal from "./pages/PharmacyPortal.jsx";
import PharmacyAdminPage from "./pages/PharmacyAdminPage.jsx";
import TechnicianPortal from "./pages/TechnicianPortal.jsx";
import AdminPortal from "./pages/AdminPortal.jsx";
import ReceptionistPortal from "./pages/ReceptionistPortal.jsx";
import CounterPortal from "./pages/CounterPortal.jsx";
import InvoicePage from "./pages/InvoicePage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { ROLES } from "./constants";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/doctorportal" element={
          <ProtectedRoute element={<DoctorPortal />} allowedRoles={[ROLES.DOCTOR, ROLES.ADMIN]} />
        } />

        <Route path="/pharmacy" element={
          <ProtectedRoute element={<PharmacyPortal />} allowedRoles={[ROLES.PHARMACY, ROLES.ADMIN]} />
        } />

        <Route path="/pharmacy-admin" element={
          <ProtectedRoute element={<PharmacyAdminPage />} allowedRoles={[ROLES.PHARMACY_ADMIN, ROLES.ADMIN]} />
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute element={<TechnicianPortal />} allowedRoles={[ROLES.TECHNICIAN, ROLES.ADMIN]} />
        } />

        <Route path="/receptionist" element={
          <ProtectedRoute element={<ReceptionistPortal />} allowedRoles={[ROLES.RECEPTIONIST, ROLES.ADMIN]} />
        } />

        <Route path="/counter" element={
          <ProtectedRoute element={<CounterPortal />} allowedRoles={[ROLES.COUNTER, ROLES.ADMIN]} />
        } />

        <Route path="/invoice" element={
          <ProtectedRoute element={<InvoicePage />}
            allowedRoles={[ROLES.COUNTER, ROLES.PHARMACY, ROLES.PHARMACY_ADMIN, ROLES.ADMIN, ROLES.DOCTOR]} />
        } />

        <Route path="/admin" element={
          <ProtectedRoute element={<AdminPortal />} allowedRoles={[ROLES.ADMIN]} />
        } />

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
