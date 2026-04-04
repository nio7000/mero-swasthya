import React, { useState } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE, ROLE_ROUTES, STORAGE_KEYS } from "../constants";

const CSS = `
.layout{display:flex;min-height:100vh;}

/* ── LEFT ── */
.left{
  flex:1;background:var(--primary-dk);
  display:flex;flex-direction:column;
  justify-content:space-between;
  padding:52px 60px;
  position:relative;overflow:hidden;
}

/* background texture */
.grid{position:absolute;inset:0;pointer-events:none;opacity:.04;
  background-image:linear-gradient(rgba(174,214,241,1) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(174,214,241,1) 1px,transparent 1px);
  background-size:52px 52px;}
.glow-tl{position:absolute;top:-160px;left:-160px;width:520px;height:520px;border-radius:50%;
  background:radial-gradient(circle,rgba(46,134,193,.22) 0%,transparent 65%);pointer-events:none;}
.glow-br{position:absolute;bottom:-140px;right:-100px;width:420px;height:420px;border-radius:50%;
  background:radial-gradient(circle,rgba(46,134,193,.14) 0%,transparent 65%);pointer-events:none;}

/* decorative rings */
.ring{position:absolute;border-radius:50%;border:1px solid rgba(174,214,241,.1);pointer-events:none;}
.r1{width:600px;height:600px;top:50%;left:50%;transform:translate(-50%,-50%);}
.r2{width:420px;height:420px;top:50%;left:50%;transform:translate(-50%,-50%);}
.r3{width:240px;height:240px;top:50%;left:50%;transform:translate(-50%,-50%);}

/* center brand */
.left-center{
  position:relative;z-index:1;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  flex:1;text-align:center;gap:18px;
}
.big-mero{
  font-family:var(--font-serif);
  font-size:72px;font-weight:600;
  color:#fff;line-height:1;
  letter-spacing:-1px;
}
.big-swasthya{
  font-family:var(--font-serif);
  font-size:72px;font-weight:600;
  font-style:italic;
  color:var(--accent-lt);
  line-height:1;
  letter-spacing:-1px;
}
.left-tagline{
  font-size:13px;color:rgba(255,255,255,.4);
  text-transform:uppercase;letter-spacing:2px;
  margin-top:6px;
}
.left-divider{
  width:48px;height:2px;
  background:linear-gradient(90deg,transparent,var(--accent),transparent);
  border-radius:2px;
}

/* pills */
.pills{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px;}
.pill{
  padding:5px 14px;border-radius:20px;
  background:rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.12);
  font-size:12px;color:rgba(255,255,255,.55);
  font-weight:500;letter-spacing:.3px;
}

.left-foot{
  position:relative;z-index:1;
  font-size:11.5px;color:rgba(255,255,255,.2);
  text-align:center;
}

/* ── RIGHT ── */
.right{
  width:460px;flex-shrink:0;background:var(--surface);
  display:flex;flex-direction:column;justify-content:center;
  padding:64px 52px;
}
.right-eyebrow{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--accent);margin-bottom:10px;}
.right-title{font-family:var(--font-serif);font-size:30px;font-weight:600;color:var(--primary-dk);margin-bottom:8px;}
.right-sub{font-size:14px;color:var(--text3);margin-bottom:36px;line-height:1.6;}
.field{margin-bottom:20px;}
.f-lbl{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text2);margin-bottom:7px;}
.ctrl{width:100%;padding:13px 15px;font-family:var(--font);font-size:15px;color:var(--text);background:var(--surface2);border:1.5px solid var(--border);border-radius:8px;outline:none;transition:.15s;}
.ctrl:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(46,134,193,.12);background:#fff;}
.ctrl::placeholder{color:var(--text3);}
.btn{width:100%;margin-top:8px;padding:15px;background:var(--primary-dk);color:#fff;border:none;border-radius:8px;font-family:var(--font);font-size:15px;font-weight:700;cursor:pointer;transition:.15s;box-shadow:0 4px 16px rgba(21,67,96,.25);}
.btn:hover:not(:disabled){background:var(--primary);box-shadow:0 6px 20px rgba(21,67,96,.35);}
.btn:disabled{background:var(--border);cursor:not-allowed;box-shadow:none;}
.divider{display:flex;align-items:center;gap:14px;margin:28px 0;}
.divider-line{flex:1;height:1px;background:var(--border);}
.divider-txt{font-size:12px;color:var(--text3);}
.info-row{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:var(--surface2);border-radius:8px;border:1.5px solid var(--border);}
.info-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:5px;}
.info-txt{font-size:13px;color:var(--text3);line-height:1.6;}

@media(max-width:900px){.left{display:none;}.right{width:100%;padding:48px 32px;}}
`;

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await axios.post(
        `${API_BASE}/auth/login`,
        new URLSearchParams({ username: email, password }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      localStorage.setItem(STORAGE_KEYS.TOKEN,     res.data.access_token);
      localStorage.setItem(STORAGE_KEYS.ROLE,      res.data.role);
      localStorage.setItem(STORAGE_KEYS.EMAIL,     res.data.email);
      localStorage.setItem(STORAGE_KEYS.FULL_NAME, res.data.full_name || "User");
      toast.success("Welcome back.");
      setTimeout(() => { window.location.href = ROLE_ROUTES[res.data.role] || "/"; }, 900);
    } catch {
      toast.error("Invalid credentials or server error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="layout">

        {/* ── LEFT ── */}
        <div className="left">
          <div className="grid"/>
          <div className="glow-tl"/><div className="glow-br"/>
          <div className="ring r1"/><div className="ring r2"/><div className="ring r3"/>

          <div className="left-center">
            <div>
              <div className="big-mero">Mero</div>
              <div className="big-swasthya">Swasthya</div>
            </div>
            <div className="left-divider"/>
            <div className="left-tagline">AI Patient Care System</div>
            <div className="pills">
              {["Doctor","Receptionist","Pharmacist","Technician","Counter","Admin"].map(r=>(
                <span className="pill" key={r}>{r}</span>
              ))}
            </div>
          </div>

          <div className="left-foot">© {new Date().getFullYear()} Mero Swasthya · All rights reserved.</div>
        </div>

        {/* ── RIGHT ── */}
        <div className="right">
          <div className="right-eyebrow">Secure Access</div>
          <div className="right-title">Sign in to your portal</div>
          <div className="right-sub">Enter your credentials below. You'll be redirected to your role-specific dashboard.</div>

          <form onSubmit={handleLogin}>
            <div className="field">
              <label className="f-lbl">Email Address</label>
              <input className="ctrl" type="email" placeholder="you@hospital.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label className="f-lbl">Password</label>
              <input className="ctrl" type="password" placeholder="Enter your password"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="divider">
            <div className="divider-line"/>
            <span className="divider-txt">Note</span>
            <div className="divider-line"/>
          </div>

          <div className="info-row">
            <div className="info-dot"/>
            <div className="info-txt">
              All roles — doctors, admin, receptionist, pharmacy, technician, and counter — use this single login. Contact your administrator if you need access.
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
