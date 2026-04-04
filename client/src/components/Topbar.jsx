import React from "react";
import { STORAGE_KEYS } from "../constants";

export default function Topbar({ role }) {
  const user = localStorage.getItem(STORAGE_KEYS.FULL_NAME) || localStorage.getItem(STORAGE_KEYS.EMAIL) || "User";

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center" }}>
        <span className="topbar-brand">Mero <em>Swasthya</em></span>
        <div className="topbar-sep" />
        <span className="topbar-role">{role}</span>
      </div>
      <div className="topbar-right">
        <span className="topbar-user">Signed in as&nbsp;<strong>{user}</strong></span>
        <button className="btn-out" onClick={handleLogout}>Sign Out</button>
      </div>
    </header>
  );
}
