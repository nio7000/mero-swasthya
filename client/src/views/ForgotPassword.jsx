import React, { useState, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/auth.css";
import { forgotPassword, setupAccount } from "../services/api";
import { STORAGE_KEYS } from "../constants";

const PILLS = ["Doctor","Receptionist","Pharmacist","Technician","Counter","Admin"];

export default function ForgotPassword() {
  const [step,    setStep]    = useState(1); // 1 = email, 2 = otp
  const [email,   setEmail]   = useState("");
  const [digits,  setDigits]  = useState(["","","","","",""]);
  const [loading, setLoading] = useState(false);
  const refs = [useRef(),useRef(),useRef(),useRef(),useRef(),useRef()];

  const otp = digits.join("");

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      toast.success("OTP sent to your email.");
      setStep(2);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (i, val) => {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs[i + 1].current.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs[i - 1].current.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = ["","","","","",""];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    refs[Math.min(pasted.length, 5)].current.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length < 6) { toast.error("Enter all 6 digits"); return; }
    setLoading(true);
    try {
      const res = await setupAccount(email.trim().toLowerCase(), otp);
      const { access_token, role, email: userEmail, full_name, id } = res.data;
      localStorage.setItem(STORAGE_KEYS.TOKEN,     access_token);
      localStorage.setItem(STORAGE_KEYS.ROLE,      role);
      localStorage.setItem(STORAGE_KEYS.EMAIL,     userEmail);
      localStorage.setItem(STORAGE_KEYS.FULL_NAME, full_name || "");
      localStorage.setItem("userId", String(id || ""));
      localStorage.setItem("mustChangePassword", "1");
      toast.success("Verified! Set your new password.");
      setTimeout(() => { window.location.href = "/change-password"; }, 1000);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  const AuthLeft = () => (
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
  );

  return (
    <>
      <ToastContainer position="top-center" autoClose={4000} />
      <div className="auth-layout">
        <AuthLeft />

        <div className="auth-right">
          <div className="auth-steps">
            <div className={`auth-step-dot${step >= 1 ? " done" : ""}`}/>
            <div className={`auth-step-dot${step >= 2 ? " done" : ""}`}/>
          </div>

          {step === 1 ? (
            <>
              <div className="auth-eyebrow">Account Recovery</div>
              <div className="auth-title">Forgot your password?</div>
              <div className="auth-sub">
                Enter your registered email and we'll send you a 6-digit verification code.
              </div>
              <form onSubmit={handleSendOtp}>
                <div className="auth-field">
                  <label className="auth-lbl">Email Address</label>
                  <input className="auth-ctrl" type="email" placeholder="you@hospital.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button className="auth-btn" type="submit" disabled={loading}>
                  {loading ? "Sending…" : "Send OTP"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="auth-eyebrow">Account Recovery</div>
              <div className="auth-title">Enter your OTP</div>
              <div className="auth-sub">
                A 6-digit code was sent to <strong>{email}</strong>. Enter it below to reset your password.
              </div>
              <form onSubmit={handleVerify}>
                <div className="auth-field">
                  <label className="auth-lbl">Verification Code</label>
                  <div className="auth-otp-boxes">
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={refs[i]}
                        className={`auth-otp-box${d ? " filled" : ""}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        placeholder="·"
                        onChange={e => handleDigit(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        onPaste={i === 0 ? handlePaste : undefined}
                      />
                    ))}
                  </div>
                </div>
                <button className="auth-btn" type="submit" disabled={loading || otp.length < 6}>
                  {loading ? "Verifying…" : "Verify & Reset Password"}
                </button>
              </form>
              <div style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--text3)" }}>
                Wrong email?{" "}
                <button onClick={() => { setStep(1); setDigits(["","","","","",""]); }}
                  style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                  Go back
                </button>
              </div>
            </>
          )}

          <div className="auth-back">
            Remembered it? <a href="/">Back to Sign In</a>
          </div>
        </div>
      </div>
    </>
  );
}
