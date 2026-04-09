import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/auth.css";
import { useNavigate } from "react-router-dom";
import { registerSendOtp, registerVerifyOtp, changePassword } from "../services/api";
import { STORAGE_KEYS, ROLE_ROUTES, ROLES } from "../constants";

const DOCTOR_SPECIALIZATIONS = [
  "General Medicine", "Cardiology", "Neurology", "Orthopedics",
  "Pediatrics", "Gynecology", "Dermatology", "Psychiatry",
  "Ophthalmology", "ENT", "Radiology", "Pathology", "Other",
];

const ALL_ROLES = [
  { value: ROLES.DOCTOR,         label: "Doctor" },
  { value: ROLES.RECEPTIONIST,   label: "Receptionist" },
  { value: ROLES.PHARMACY,       label: "Pharmacist" },
  { value: ROLES.PHARMACY_ADMIN, label: "Pharmacy Admin" },
  { value: ROLES.TECHNICIAN,     label: "Lab Technician" },
  { value: ROLES.COUNTER,        label: "Counter Staff" },
];

// ── step 1 ──────────────────────────────────────────────────────────────────
function StepOne({ onNext }) {
  const [fullName,       setFullName]       = useState("");
  const [email,          setEmail]          = useState("");
  const [role,           setRole]           = useState("");
  const [specialization, setSpecialization] = useState("");
  const [loading,        setLoading]        = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await registerSendOtp({ full_name: fullName, email, role, specialization });
      toast.success("Verification code sent to your Gmail!");
      onNext({ fullName, email, role, specialization });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to send code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="auth-field">
        <label className="auth-lbl">Full Name</label>
        <input className="auth-ctrl" placeholder="Dr. Hari Prasad Sharma" value={fullName}
          onChange={e => setFullName(e.target.value)} required />
      </div>
      <div className="auth-field">
        <label className="auth-lbl">Gmail Address</label>
        <input className="auth-ctrl" type="email" placeholder="you@gmail.com" value={email}
          onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="auth-field">
        <label className="auth-lbl">Role</label>
        <select className="auth-ctrl" value={role} onChange={e => setRole(e.target.value)} required>
          <option value="">— Select your role —</option>
          {ALL_ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      {role === ROLES.DOCTOR && (
        <div className="auth-field">
          <label className="auth-lbl">Specialization</label>
          <select className="auth-ctrl" value={specialization}
            onChange={e => setSpecialization(e.target.value)} required>
            <option value="">— Select specialization —</option>
            {DOCTOR_SPECIALIZATIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
      <button className="auth-btn" type="submit" disabled={loading}>
        {loading ? "Sending code…" : "Send Verification Code"}
      </button>
    </form>
  );
}

// ── step 2 ──────────────────────────────────────────────────────────────────
function StepTwo({ regData, onNext }) {
  const [otp,     setOtp]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await registerVerifyOtp({ ...regData, otp });
      toast.success("Account created! Set your password now.");
      localStorage.setItem(STORAGE_KEYS.TOKEN,     res.data.access_token);
      localStorage.setItem(STORAGE_KEYS.ROLE,      res.data.role);
      localStorage.setItem(STORAGE_KEYS.EMAIL,     res.data.email);
      localStorage.setItem(STORAGE_KEYS.FULL_NAME, res.data.full_name || "");
      localStorage.setItem("userId", String(res.data.id || ""));
      onNext(res.data.role);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 14, color: "var(--text3)", marginBottom: 20, lineHeight: 1.6 }}>
        A 6-digit code was sent to <strong>{regData.email}</strong>. Enter it below.
      </p>
      <div className="auth-field">
        <label className="auth-lbl">Verification Code</label>
        <input className="auth-ctrl" placeholder="_ _ _ _ _ _"
          value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6} inputMode="numeric" required
          style={{ textAlign: "center", fontSize: 26, fontWeight: 700, letterSpacing: 8 }} />
      </div>
      <button className="auth-btn" type="submit" disabled={loading || otp.length < 6}>
        {loading ? "Verifying…" : "Verify & Create Account"}
      </button>
    </form>
  );
}

// ── step 3 ──────────────────────────────────────────────────────────────────
function StepThree({ role }) {
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    if (password.length < 8)  { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      await changePassword(password);
      toast.success("Password set! Logging you in…");
      setTimeout(() => {
        window.location.href = ROLE_ROUTES[role] || "/";
      }, 1200);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to set password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ fontSize: 14, color: "var(--text3)", marginBottom: 20, lineHeight: 1.6 }}>
        Account verified! Choose a strong password to secure your account.
      </p>
      <div className="auth-field">
        <label className="auth-lbl">New Password</label>
        <input className="auth-ctrl" type="password" placeholder="At least 8 characters"
          value={password} onChange={e => setPassword(e.target.value)} required />
        <div className="auth-pw-hint">Use a mix of letters, numbers, and symbols.</div>
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
  );
}

// ── main ─────────────────────────────────────────────────────────────────────
export default function Signup() {
  const [step,    setStep]    = useState(1);
  const [regData, setRegData] = useState(null);
  const [role,    setRole]    = useState("");

  const STEP_TITLES = [
    { eyebrow: "New Account",    title: "Register your account",   sub: "Fill in your details. A verification code will be sent to your Gmail." },
    { eyebrow: "Verify Email",   title: "Check your Gmail",        sub: "Enter the 6-digit code we sent to your inbox." },
    { eyebrow: "Secure Account", title: "Set your password",       sub: "Choose a strong password to protect your account." },
  ];
  const { eyebrow, title, sub } = STEP_TITLES[step - 1];

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
          </div>
          <div className="auth-foot">© 2026 Mero Swasthya · All rights reserved.</div>
        </div>

        <div className="auth-right wide">
          <div className="auth-eyebrow">{eyebrow}</div>
          <div className="auth-title">{title}</div>
          <div className="auth-sub">{sub}</div>

          <div className="auth-steps">
            {[1, 2, 3].map(s => (
              <div key={s} className={`auth-step-dot${step >= s ? " done" : ""}`} />
            ))}
          </div>

          {step === 1 && (
            <StepOne onNext={(data) => { setRegData({ full_name: data.fullName, email: data.email, role: data.role, specialization: data.specialization }); setStep(2); }} />
          )}
          {step === 2 && (
            <StepTwo regData={regData} onNext={(r) => { setRole(r); setStep(3); }} />
          )}
          {step === 3 && (
            <StepThree role={role} />
          )}

          <div className="auth-back">
            Already have an account? <a href="/">Sign in</a>
          </div>
        </div>

      </div>
    </>
  );
}
