import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/auth.css";
import { changePassword } from "../services/api";
import { STORAGE_KEYS, ROLE_ROUTES } from "../constants";

const PILLS = ["Doctor","Receptionist","Pharmacist","Technician","Counter","Admin"];

export default function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);

  const role = localStorage.getItem(STORAGE_KEYS.ROLE);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    if (password.length < 8)  { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await changePassword(password);
      toast.success("Password updated! Redirecting…");
      setTimeout(() => { window.location.href = ROLE_ROUTES[role] || "/"; }, 1200);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ToastContainer position="top-center" autoClose={4000} />
      <div className="auth-layout">

        <div className="auth-left">
          <div className="auth-grid"/><div className="auth-glow-tl"/><div className="auth-glow-br"/>
          <div className="auth-ring auth-r1"/><div className="auth-ring auth-r2"/><div className="auth-ring auth-r3"/>
          <div className="auth-left-center">
            <div>
              <div className="auth-big-mero">Mero</div>
              <div className="auth-big-swasthya">Swasthya</div>
            </div>
            <div className="auth-divider"/>
            <div className="auth-tagline">AI Patient Care System</div>
            <div className="auth-pills">
              {PILLS.map(r => <span className="auth-pill" key={r}>{r}</span>)}
            </div>
          </div>
          <div className="auth-foot">© 2026 Mero Swasthya · All rights reserved.</div>
        </div>

        <div className="auth-right">
          <div className="auth-eyebrow">Security Required</div>
          <div className="auth-title">Set your password</div>
          <div className="auth-sub">
            You're logged in with a temporary password. Please set a new secure password to continue.
          </div>

          <div className="auth-alert">
            ⚠️ You must change your password before accessing the system.
          </div>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-lbl">New Password</label>
              <input className="auth-ctrl" type="password" placeholder="At least 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} required />
              <div className="auth-pw-hint">Use letters, numbers, and symbols for a strong password.</div>
            </div>
            <div className="auth-field">
              <label className="auth-lbl">Confirm Password</label>
              <input className="auth-ctrl" type="password" placeholder="Repeat your password"
                value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? "Saving…" : "Set Password & Enter System"}
            </button>
          </form>
        </div>

      </div>
    </>
  );
}
