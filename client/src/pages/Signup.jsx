import React, { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link, useNavigate } from "react-router-dom";
import apiClient from "../utils/api";

export default function Signup() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiClient.post("/auth/signup", { email, password });
      toast.success("Account created successfully!");
      setTimeout(() => navigate("/"), 1200);
    } catch {
      toast.error("Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ToastContainer position="top-center" autoClose={3000} />
      <div style={{ height:"100vh", background:"var(--bg)", display:"flex", justifyContent:"center", alignItems:"center" }}>
        <div style={{ background:"var(--surface)", borderRadius:"16px", padding:"50px", boxShadow:"0 8px 25px rgba(0,0,0,0.1)", textAlign:"center", width:"360px", border:"1.5px solid var(--border)" }}>
          <h2 style={{ fontSize:"24px", color:"var(--primary-dk)", marginBottom:"6px", fontFamily:"var(--font-serif)" }}>Create Account</h2>
          <p style={{ color:"var(--text3)", marginBottom:"25px", fontSize:"14px" }}>Join our AI-powered medical system</p>
          <form onSubmit={handleSignup}>
            <input type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} className="ctrl" required
              style={{ marginBottom:"12px" }} />
            <input type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} className="ctrl" required
              style={{ marginBottom:"20px" }} />
            <button type="submit" className="btn-primary" style={{ width:"100%", padding:"12px" }} disabled={loading}>
              {loading ? "Creating..." : "Sign Up"}
            </button>
          </form>
          <p style={{ marginTop:"15px", color:"var(--text3)", fontSize:"14px" }}>
            Already have an account?{" "}
            <Link to="/" style={{ color:"var(--accent)", textDecoration:"none", fontWeight:600 }}>Login</Link>
          </p>
        </div>
      </div>
    </>
  );
}
