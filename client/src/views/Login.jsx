import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/auth.css";
import useAuth from "../controllers/useAuth";
import { currentYear } from "../utils/date";
import { STORAGE_KEYS, ROLE_ROUTES } from "../constants";

const PILLS = ["Doctor","Receptionist","Pharmacist","Technician","Counter","Admin"];

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const { loading, handleLogin } = useAuth();

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const role  = localStorage.getItem(STORAGE_KEYS.ROLE);
    if (!token || !role) return;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp && Date.now() / 1000 > payload.exp) { localStorage.clear(); return; }
      const destination = ROLE_ROUTES[role];
      if (destination) window.location.replace(destination);
    } catch { localStorage.clear(); }
  }, []);

  const onSubmit = (e) => { e.preventDefault(); handleLogin(email, password); };

  return (
    <>
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="auth-layout">

        <div className="auth-left">
          <div className="auth-grid"/>
          <div className="auth-glow-tl"/><div className="auth-glow-br"/>
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
          <div className="auth-foot">© {currentYear()} Mero Swasthya · All rights reserved.</div>
        </div>

        <div className="auth-right">
          <div className="auth-eyebrow">Secure Access</div>
          <div className="auth-title">Sign in to your portal</div>
          <div className="auth-sub">Enter your credentials below. You'll be redirected to your role-specific dashboard.</div>

          <form onSubmit={onSubmit}>
            <div className="auth-field">
              <label className="auth-lbl">Email Address</label>
              <input className="auth-ctrl" type="email" placeholder="you@hospital.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="auth-field">
              <label className="auth-lbl">Password</label>
              <input className="auth-ctrl" type="password" placeholder="Enter your password"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="auth-forgot">
              <a href="/setup-account">First time? Activate account</a>
              <a href="/forgot-password">Forgot password?</a>
            </div>
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="auth-note">
            <div className="auth-note-divider">
              <div className="auth-note-line"/>
              <span className="auth-note-lbl">Note</span>
              <div className="auth-note-line"/>
            </div>
            <div className="auth-note-txt">
              All roles — doctors, admin, receptionist, pharmacy, technician, and counter — use this single login. Contact your administrator if you need access.
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
