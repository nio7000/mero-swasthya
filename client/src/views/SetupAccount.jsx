import React, { useState, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/auth.css";
import { setupAccount } from "../services/api";
import { STORAGE_KEYS } from "../constants";

export default function SetupAccount() {
  const [email,   setEmail]   = useState("");
  const [digits,  setDigits]  = useState(["","","","","",""]);
  const [loading, setLoading] = useState(false);
  const refs = [useRef(),useRef(),useRef(),useRef(),useRef(),useRef()];

  const otp = digits.join("");

  const handleDigit = (i, val) => {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs[i + 1].current.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs[i - 1].current.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = ["","","","","",""];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    refs[focusIdx].current.focus();
  };

  const handleSubmit = async (e) => {
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
      toast.success("Verified! Set your password now.");
      setTimeout(() => { window.location.href = "/change-password"; }, 1000);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid code or email. Try again.");
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
              {["Doctor","Receptionist","Pharmacist","Technician","Counter","Admin"].map(r=>(
                <span className="auth-pill" key={r}>{r}</span>
              ))}
            </div>
          </div>
          <div className="auth-foot">© 2026 Mero Swasthya · All rights reserved.</div>
        </div>

        <div className="auth-right">
          <div className="auth-eyebrow">First Time Access</div>
          <div className="auth-title">Activate your account</div>
          <div className="auth-sub">
            Enter your email and the 6-digit code sent to your Gmail by the administrator.
          </div>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-lbl">Your Email Address</label>
              <input className="auth-ctrl" type="email" placeholder="you@hospital.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>

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

            <button className="auth-btn" type="submit" disabled={loading || otp.length < 6 || !email}>
              {loading ? "Verifying…" : "Verify & Set Password"}
            </button>
          </form>

          <div className="auth-note">
            <div className="auth-note-divider">
              <div className="auth-note-line"/>
              <span className="auth-note-lbl">Note</span>
              <div className="auth-note-line"/>
            </div>
            <div className="auth-note-txt">
              Check your Gmail inbox for a code from Mero Swasthya. If you did not receive it, contact your administrator.
            </div>
          </div>

          <div className="auth-back">
            Already set up? <a href="/">Sign in</a>
          </div>
        </div>

      </div>
    </>
  );
}
