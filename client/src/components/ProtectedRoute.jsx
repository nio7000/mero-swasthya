import React from "react";
import { Navigate } from "react-router-dom";
import { STORAGE_KEYS } from "../constants";

export default function ProtectedRoute({ element, allowedRoles }) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const role  = localStorage.getItem(STORAGE_KEYS.ROLE);

  if (!token || !role) {
    localStorage.clear();
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return element;
}
