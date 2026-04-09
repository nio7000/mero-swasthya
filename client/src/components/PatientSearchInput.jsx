import React, { useState, useMemo } from "react";

/**
 * Reusable patient search dropdown.
 *
 * Props:
 *   patients  — array of patient objects (from /patients/ API)
 *               Each has: { id, patient_id, name, age, sex, contact, address }
 *   value     — controlled input string
 *   onChange  — called with the raw string as user types
 *   onSelect  — called with the selected patient object
 *   placeholder
 */
export default function PatientSearchInput({ patients = [], value, onChange, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = (value || "").trim().toLowerCase();
    if (!q) return [];
    return patients.filter(p =>
      (p.name       || "").toLowerCase().includes(q) ||
      (p.patient_id || "").toLowerCase().includes(q) ||
      (p.contact    || "").includes(q)
    ).slice(0, 12);
  }, [value, patients]);

  return (
    <div style={{ position: "relative" }}>
      <input
        className="search-input"
        placeholder={placeholder || "Search by name, patient ID or contact…"}
        value={value}
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        style={{ width: "100%" }}
      />
      {open && filtered.length > 0 && (
        <div className="drop" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300 }}>
          {filtered.map(p => (
            <div key={p.id} className="drop-item" onMouseDown={() => { onSelect(p); onChange(p.name); setOpen(false); }}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: "var(--text3)", fontSize: 13, marginLeft: 10 }}>
                {p.patient_id}
                {p.age  ? ` · ${p.age}y`  : ""}
                {p.sex  ? ` · ${p.sex}`   : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
