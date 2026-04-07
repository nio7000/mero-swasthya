import { Navigate } from "react-router-dom";
import { STORAGE_KEYS } from "../constants";

/**
 * Wraps a route so only authenticated users with an allowed role can access it.
 *
 * Checks:
 *  1. Token and role exist in localStorage.
 *  2. JWT has not expired (reads the exp claim from the payload).
 *  3. The stored role is in the allowedRoles list.
 *
 * If any check fails, localStorage is cleared and the user is sent back to
 * the login page. This prevents the browser Back button from bypassing auth.
 */
export default function ProtectedRoute({ element, allowedRoles }) {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  const role  = localStorage.getItem(STORAGE_KEYS.ROLE);

  // No credentials stored — send to login
  if (!token || !role) {
    localStorage.clear();
    return <Navigate to="/" replace />;
  }

  // Decode the JWT payload and check expiry without verifying the signature.
  // Signature verification is always done server-side on every API request.
  try {
    const payload   = JSON.parse(atob(token.split(".")[1]));
    const isExpired = payload.exp && Date.now() / 1000 > payload.exp;
    if (isExpired) {
      localStorage.clear();
      return <Navigate to="/" replace />;
    }
  } catch {
    // Malformed token — treat as unauthenticated
    localStorage.clear();
    return <Navigate to="/" replace />;
  }

  // Role not allowed for this route
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return element;
}
