import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/auth.css";
import { forgotPassword } from "../services/api";

const PILLS = ["Doctor","Receptionist","Pharmacist","Technician","Counter","Admin"];

export default function ForgotPassword() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
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
          <div className="auth-eyebrow">Account Recovery</div>
          <div className="auth-title">Forgot your password?</div>
          <div className="auth-sub">
            Enter your registered Gmail address and we'll send you a temporary password instantly.
          </div>

          {sent ? (
            <div className="auth-success-box">
              <div className="auth-success-icon">📧</div>
              <p style={{ fontWeight: 700, color: "var(--primary-dk)", marginBottom: 8 }}>Email sent!</p>
              <p style={{ fontSize: 14, color: "var(--text3)", lineHeight: 1.6 }}>
                A temporary password has been sent to <strong>{email}</strong>.<br />
                Log in with it and you'll be prompted to set a new password immediately.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-lbl">Gmail Address</label>
                <input className="auth-ctrl" type="email" placeholder="you@hospital.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send Temporary Password"}
              </button>
            </form>
          )}

          <div className="auth-back">
            Remembered it? <a href="/">Back to Sign In</a>
          </div>
        </div>

      </div>
    </>
  );
}
