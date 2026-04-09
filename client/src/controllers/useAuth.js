import { useState } from "react";
import { toast } from "react-toastify";
import { login } from "../services/api";
import { STORAGE_KEYS, ROLE_ROUTES } from "../constants";

export default function useAuth() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (email, password) => {
    try {
      setLoading(true);
      const res = await login(email, password);
      const { access_token, role, email: userEmail, full_name, id, must_change_password } = res.data;

      localStorage.setItem(STORAGE_KEYS.TOKEN,     access_token);
      localStorage.setItem(STORAGE_KEYS.ROLE,      role);
      localStorage.setItem(STORAGE_KEYS.EMAIL,     userEmail);
      localStorage.setItem(STORAGE_KEYS.FULL_NAME, full_name || "User");
      localStorage.setItem("userId", String(id || ""));

      toast.success("Welcome back.");

      // If the user must set a new password, redirect to the change-password page
      if (must_change_password) {
        setTimeout(() => { window.location.href = "/change-password"; }, 900);
      } else {
        setTimeout(() => { window.location.href = ROLE_ROUTES[role] || "/"; }, 900);
      }
    } catch {
      toast.error("Invalid credentials or server error.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return { loading, handleLogin, logout };
}
