import { Navigate } from "react-router-dom";
import { STORAGE_KEYS, ROLE_ROUTES } from "../constants";

// All portal paths that belong exclusively to a role
const PORTAL_PATHS = new Set(Object.values(ROLE_ROUTES));

export default function ProtectedRoute({ element }) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const role  = localStorage.getItem(STORAGE_KEYS.ROLE);

  // No credentials — send to login
  if (!token || !role) {
    localStorage.clear();
    return <Navigate to="/" replace />;
  }

  // Check expiry without verifying signature (server always verifies on API calls)
  try {
    const payload   = JSON.parse(atob(token.split(".")[1]));
    const isExpired = payload.exp && Date.now() / 1000 > payload.exp;
    if (isExpired) {
      localStorage.clear();
      return <Navigate to="/" replace />;
    }
  } catch {
    localStorage.clear();
    return <Navigate to="/" replace />;
  }

  // If the current path is a portal route but not the user's own portal,
  // redirect silently to their designated portal.
  // Shared utility pages (e.g. /invoice) are not in PORTAL_PATHS and pass through.
  const ownRoute = ROLE_ROUTES[role];
  const currentPath = window.location.pathname;
  if (ownRoute && PORTAL_PATHS.has(currentPath) && currentPath !== ownRoute) {
    return <Navigate to={ownRoute} replace />;
  }

  return element;
}
