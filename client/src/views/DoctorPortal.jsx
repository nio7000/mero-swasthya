import React, { useState, useEffect, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import apiClient, { authHeader, getToken } from "../utils/api";
import { fmtDate } from "../utils/date";
import { currency } from "../utils/format";
import { STORAGE_KEYS } from "../constants";
import Topbar from "../components/Topbar";
import PatientSearchInput from "../components/PatientSearchInput";

/* ── helpers ── */
const blankMed    = () => ({ name: "", dose: "", timing: "", duration: "", selected: false });
const byRecent    = (l) => [...l].sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
const isValidTest = (t) => { const n = typeof t==="string"?t:t?.test_name; return n&&n.trim()!==""&&n!=="No tests selected"; };
const decodeToken = (t) => { try { return JSON.parse(atob(t.split(".")[1])); } catch { return null; } };

/* ── CSS ── */
const CSS = `
.rx-body{padding:16px 18px;}
.sub-lbl{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin:16px 0 8px;}
.sub-lbl:first-child{margin-top:0;}
.rx-foot{margin-top:14px;padding-top:12px;border-top:1.5px dashed var(--border);display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--text3);}
.rx-foot strong{color:var(--text2);font-weight:600;}
.btn-followup{font-family:var(--font);font-size:12.5px;font-weight:600;padding:6px 14px;border-radius:5px;border:1.5px solid #AED6F1;background:var(--primary-lt);color:var(--primary-dk);cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:6px;}
.btn-followup:hover{background:#AED6F1;border-color:var(--accent);}
.btn-followup.assigned{background:var(--success-lt);border-color:#A9DFBF;color:var(--success);}
.btn-followup.assigned:hover{background:#A9DFBF;}
.followup-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--success);background:var(--success-lt);border:1px solid #A9DFBF;padding:4px 10px;border-radius:4px;}
.ai-card{border:1.5px solid var(--border);border-left:4px solid var(--accent);border-radius:8px;margin-bottom:20px;overflow:hidden;}
.ai-card-head{background:#EAF3FB;padding:13px 18px;border-bottom:1.5px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.ai-name{font-size:16px;font-weight:600;color:var(--primary-dk);}
.ai-badge{font-size:11.5px;font-weight:700;color:var(--accent);background:#D6EAF8;border:1px solid #AED6F1;padding:3px 10px;border-radius:3px;letter-spacing:.4px;text-transform:uppercase;}
.ai-info-row{display:flex;gap:28px;flex-wrap:wrap;padding:10px 18px;background:var(--surface2);border-bottom:1.5px solid var(--border);font-size:14px;color:var(--text2);}
.ai-info-row strong{color:var(--text);font-weight:600;}
.ai-body{padding:16px 18px;}
.med-row{display:flex;gap:8px;margin-bottom:10px;align-items:flex-start;}
.med-name{position:relative;flex:2.2;}
.med-drop{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:200;background:#fff;border:1.5px solid var(--border-dk);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.14);overflow:hidden;max-height:180px;overflow-y:auto;}
.med-opt{padding:11px 14px;font-size:14.5px;cursor:pointer;color:var(--text);border-bottom:1px solid var(--border);transition:background .12s;}
.med-opt:last-child{border-bottom:none;}
.med-opt:hover{background:var(--primary-lt);}
.btn-add{display:inline-flex;align-items:center;gap:5px;font-family:var(--font);font-size:14px;font-weight:600;padding:9px 18px;border-radius:5px;border:1.5px solid;cursor:pointer;letter-spacing:.2px;transition:.15s;margin-top:4px;}
.btn-add-p{color:var(--primary);background:var(--primary-lt);border-color:#AED6F1;}
.btn-add-p:hover{background:#AED6F1;border-color:var(--accent);}
.btn-add-s{color:var(--text2);background:var(--surface2);border-color:var(--border);}
.btn-add-s:hover{background:var(--border);border-color:var(--border-dk);}
.btn-save{width:100%;padding:15px;background:var(--primary-dk);color:#fff;border:none;border-radius:6px;font-family:var(--font);font-size:16px;font-weight:700;cursor:pointer;letter-spacing:.4px;margin-top:28px;transition:.15s;box-shadow:0 3px 10px rgba(21,67,96,.3);}
.btn-save:hover{background:var(--primary);}
.btn-save:active{transform:scale(.99);}
.patient-tag{display:inline-flex;align-items:center;background:var(--primary-lt);color:var(--primary-dk);font-size:14px;font-weight:600;padding:4px 14px;border-radius:4px;border:1px solid #AED6F1;}
`;

export default function DoctorPortal() {
  const [reports,          setReports]          = useState([]);
  const [allMedicines,     setAllMedicines]      = useState([]);
  const [testsList,        setTestsList]         = useState([]);
  const [prescriptions,    setPrescriptions]     = useState([]);
  const [aiReports,        setAIReports]         = useState([]);
  const [searchTerm,       setSearchTerm]        = useState("");
  const [showSuggestions,  setShowSuggestions]   = useState(false);
  const [selectedPatientId,setSelectedPatientId] = useState("");
  const [selectedName,     setSelectedName]      = useState("");
  const [diagnosis,        setDiagnosis]         = useState("");
  const [medicines,        setMedicines]         = useState([blankMed()]);
  const [tests,            setTests]             = useState([""]);
  const [doctorEmail,      setDoctorEmail]       = useState("");
  const [sortRx,           setSortRx]            = useState(false);
  const [sortAI,           setSortAI]            = useState(false);
  const [followupAssigned, setFollowupAssigned]  = useState({});

  const diagRef = useRef(null);

  useEffect(() => {
    if (!diagRef.current) return;
    diagRef.current.style.height = "auto";
    diagRef.current.style.height = diagRef.current.scrollHeight + "px";
  }, [diagnosis]);

  useEffect(() => {
    if (!getToken()) {
      toast.warn("Session expired. Please login.");
      return void setTimeout(() => (window.location.href = "/"), 1400);
    }
    (async () => {
      const payload   = decodeToken(getToken());
      const fromToken = payload?.full_name || payload?.name || payload?.username || payload?.sub;
      if (fromToken && !fromToken.includes("@")) {
        setDoctorEmail(fromToken);
      } else {
        try {
          const res = await apiClient.get("/users/me");
          setDoctorEmail(res.data?.full_name || res.data?.name || res.data?.email || "Doctor");
        } catch {
          setDoctorEmail(localStorage.getItem(STORAGE_KEYS.EMAIL) || "Doctor");
        }
      }
      try {
        const [rr, mr, tr] = await Promise.all([
          apiClient.get("/patients/"),
          apiClient.get("/pharmacy-admin/medicines/"),
          apiClient.get("/lab/tests"),
        ]);
        setReports(rr.data || []);
        setAllMedicines(mr.data.medicines || []);
        setTestsList(tr.data.tests || tr.data || []);
      } catch {
        toast.error("Failed to load data. Please login again.");
        setTimeout(() => (window.location.href = "/"), 1400);
      }
    })();
  }, []);

  const loadPatient = async (id) => {
    try {
      const [pr, ar, fu] = await Promise.all([
        apiClient.get(`/prescriptions/${id}`),
        apiClient.get(`/ai-reports/${id}`),
        apiClient.get(`/followup/check/${id}`),
      ]);
      setPrescriptions(pr.data.prescriptions || []);
      setAIReports(ar.data.ai_reports || []);
      setFollowupAssigned(prev => ({ ...prev, [id]: fu.data.has_followup === true }));
    } catch { /* silent */ }
  };

  const handleSelectPatient = (r) => {
    setSearchTerm(r.name || "");
    setSelectedName(r.name || "");
    setSelectedPatientId(r.id);
    setShowSuggestions(false);
    loadPatient(r.id);
  };

  const filteredReports = reports.filter(r => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return false;
    const name    = (r.name    || "").toLowerCase();
    const pid     = (r.patient_id || "").toLowerCase();
    const contact = (r.contact || "").toLowerCase();
    const address = (r.structured_data?.["Address"]      || "").toLowerCase();
    return name.includes(q) || pid.includes(q) || contact.includes(q) || address.includes(q);
  });

  /* medicine helpers */
  const setMed    = (i, f, v) => { const u = [...medicines]; u[i][f] = v; setMedicines(u); };
  const typeAhead = (i, v)    => { const u = [...medicines]; u[i].name = v; u[i].selected = false; setMedicines(u); };
  const pickMed   = (i, m)    => {
    const stock = m.total_qty ?? (Array.isArray(m.stock) ? m.stock.reduce((a,s)=>a+(s.quantity||0),0) : 0);
    if (stock === 0) {
      toast.error(`${m.name} is out of stock — cannot be added to prescription.`);
      return;
    }
    if (stock < (m.threshold || 10)) {
      toast.warn(`Low stock alert: ${m.name} has only ${stock} units remaining. Added with caution.`);
    }
    const u = [...medicines]; u[i].name = m.name; u[i].selected = true; setMedicines(u);
  };
  const medSugg   = (v)       => allMedicines.filter(m => m.name.toLowerCase().includes(v.toLowerCase())).slice(0, 5);
  const setTest   = (i, v)    => { const u = [...tests]; u[i] = v; setTests(u); };

  const handleSubmit = async () => {
    if (!selectedPatientId) return toast.warn("Please select a patient first.");
    if (!diagnosis.trim())  return toast.warn("Diagnosis is required.");
    const validMeds  = medicines.filter(m => m.name.trim() || m.dose.trim() || m.duration.trim());
    const validTests = tests.filter(t => t?.trim());
    try {
      await apiClient.post(
        "/prescriptions/",
        { patient_id: parseInt(selectedPatientId), diagnosis, medicines: validMeds, tests: validTests },
        { headers: { "Content-Type": "application/json" } }
      );
      toast.success("Prescription saved successfully.");
      setPrescriptions(prev => [...prev, {
        diagnosis, medicines: validMeds, tests: validTests,
        doctor: doctorEmail, created_at: new Date().toISOString(),
      }]);
      setDiagnosis(""); setMedicines([blankMed()]); setTests([""]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save prescription.");
    }
  };

  /* ── Follow-up handler ── */
  const handleFollowUp = async (patientId) => {
    const isAssigned = followupAssigned[patientId];
    try {
      if (isAssigned) {
        await apiClient.delete(`/followup/cancel/${patientId}`);
        setFollowupAssigned(prev => ({ ...prev, [patientId]: false }));
        toast.info("Follow-up cancelled.");
      } else {
        await apiClient.post(
          "/followup/assign/",
          { patient_id: patientId },
          { headers: { "Content-Type": "application/json" } }
        );
        setFollowupAssigned(prev => ({ ...prev, [patientId]: true }));
        toast.success("Follow-up assigned. Patient's next visit will be free.");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update follow-up.");
    }
  };

  const displayedRx = sortRx ? byRecent(prescriptions) : prescriptions;
  const displayedAI = sortAI ? byRecent(aiReports)     : aiReports;

  return (
    <>
      <style>{CSS}</style>
      <ToastContainer position="top-right" autoClose={3000} />

      <Topbar role="Doctor Portal" />

      <div className="workspace">

        {/* ── LEFT: Patient Records ── */}
        <div className="panel">
          <div className="panel-top">
            <div className="panel-heading">Patient Records</div>
            <div className="panel-sub">Search a patient to view prescriptions and lab reports</div>
            <div className="search-wrap">
              <PatientSearchInput
                patients={reports}
                value={searchTerm}
                onChange={v => { setSearchTerm(v); setShowSuggestions(true); }}
                onSelect={handleSelectPatient}
              />
            </div>
          </div>

          <div className="scroll">
            {!selectedPatientId && (
              <div className="empty">
                <h3>No Patient Selected</h3>
                <p>Use the search box above to find and select a patient.</p>
              </div>
            )}

            {selectedPatientId && prescriptions.length === 0 && aiReports.length === 0 && (
              <div className="empty">
                <h3>No Records Found</h3>
                <p>This patient has no prescriptions or lab reports on file.</p>
              </div>
            )}

            {/* Prescriptions */}
            {prescriptions.length > 0 && (
              <>
                <div className="sec-hd">
                  <span className="sec-title">Prescriptions</span>
                  <button className="btn-sort" onClick={() => setSortRx(!sortRx)}>
                    {sortRx ? "Default Order" : "Most Recent First"}
                  </button>
                </div>

                {displayedRx.map((p, i) => {
                  const vTests    = (p.tests || []).filter(isValidTest);
                  const isAssigned = followupAssigned[selectedPatientId];
                  return (
                    <div key={i} className="rx-card">
                      <div className="rx-card-top">
                        <div className="rx-dx-lbl">Diagnosis</div>
                        <div className="rx-dx-val">{p.diagnosis}</div>
                      </div>
                      <div className="rx-body">
                        {p.medicines?.length > 0 && (
                          <>
                            <div className="sub-lbl">Medicines Prescribed</div>
                            <div className="tbl-box">
                              <table className="tbl">
                                <thead><tr><th>Name</th><th>Dose</th><th>Timing</th><th>Duration</th></tr></thead>
                                <tbody>
                                  {p.medicines.map((m, j) => (
                                    <tr key={j}>
                                      <td>{m.name}</td><td>{m.dose}</td>
                                      <td>{m.timing}</td><td>{m.duration}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                        {vTests.length > 0 && (
                          <>
                            <div className="sub-lbl" style={{ marginTop:14 }}>Laboratory Tests</div>
                            <div className="tbl-box">
                              <table className="tbl">
                                <thead><tr><th>Test Name</th><th>Status</th></tr></thead>
                                <tbody>
                                  {vTests.map((t, j) => (
                                    <tr key={j}>
                                      <td>{typeof t === "string" ? t : t.test_name}</td>
                                      <td><span className="badge b-pending">{t.status || "Pending"}</span></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                        <div className="rx-foot">
                          <span>{fmtDate(p.created_at)}</span>
                          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                            <span>Dr. <strong>{p.doctor || "Unknown"}</strong></span>
                            {i === 0 && (
                              <button
                                className={`btn-followup ${isAssigned ? "assigned" : ""}`}
                                onClick={() => handleFollowUp(selectedPatientId)}
                              >
                                {isAssigned ? "✓ Follow-up — Cancel" : "+ Follow-up"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* AI Reports */}
            {aiReports.length > 0 && (
              <>
                <div className="sec-hd" style={{ marginTop:36 }}>
                  <span className="sec-title">AI Lab Reports</span>
                  <button className="btn-sort" onClick={() => setSortAI(!sortAI)}>
                    {sortAI ? "Default Order" : "Most Recent First"}
                  </button>
                </div>
                {displayedAI.map((r, i) => {
                  const str      = r.ocr_report?.structured_data  || {};
                  const analysis = r.ocr_report?.medical_analysis || {};
                  return (
                    <div key={i} className="ai-card">
                      <div className="ai-card-head">
                        <span className="ai-name">{r.test_name}</span>
                        <span className="ai-badge">{r.status}</span>
                      </div>
                      <div className="ai-info-row">
                        <span><strong>Patient:</strong> {str["Patient Name"] || "—"}</span>
                        <span><strong>Age:</strong> {str["Age"] || "—"}</span>
                        <span><strong>Sex:</strong> {str["Sex"] || "—"}</span>
                      </div>
                      <div className="ai-body">
                        <div className="tbl-box">
                          <table className="tbl">
                            <thead><tr>
                              <th>Parameter</th><th>Value</th><th>Unit</th><th>Reference</th><th>Status</th>
                            </tr></thead>
                            <tbody>
                              {Object.entries(analysis).map(([param, val], j) => (
                                <tr key={j}>
                                  <td>{param}</td>
                                  <td><strong>{val.value}</strong></td>
                                  <td>{val.unit}</td>
                                  <td>{val.range}</td>
                                  <td>
                                    <span className={`badge ${
                                      val.status === "High" ? "b-high" :
                                      val.status === "Low"  ? "b-low"  : "b-normal"
                                    }`}>{val.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="rx-foot" style={{ marginTop:12, paddingTop:10 }}>
                          <span>{fmtDate(r.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: New Prescription ── */}
        <div className="panel">
          <div className="panel-top">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
              <div className="panel-heading">New Prescription</div>
              {selectedPatientId && <span className="patient-tag">{selectedName}</span>}
            </div>
            <div className="panel-sub">
              {selectedPatientId ? "Fill in the details below and save" : "Select a patient from the left panel first"}
            </div>
          </div>

          <div className="scroll">
            <label className="f-lbl">Diagnosis</label>
            <textarea
              ref={diagRef}
              className="f-textarea"
              placeholder="Enter clinical diagnosis…"
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
            />

            <div className="divider" />

            <label className="f-lbl">Medicines</label>
            {medicines.map((m, i) => (
              <div key={i} className="med-row">
                <div className="med-name">
                  <input
                    type="text" className="ctrl"
                    placeholder="Search medicine…"
                    value={m.name}
                    onChange={e => typeAhead(i, e.target.value)}
                  />
                  {m.name && !m.selected && medSugg(m.name).length > 0 && (
                    <div className="med-drop">
                      {medSugg(m.name).map((med, j) => (
                        <div key={j} className="med-opt" onMouseDown={() => pickMed(i, med)}>
                          {med.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="sel" style={{ flex:".85" }}>
                  <select className="ctrl" value={m.dose} onChange={e => setMed(i, "dose", e.target.value)}>
                    <option value="">Dose</option>
                    {["1-0-1","1-1-1","0-1-0","1-0-0","0-0-1"].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="sel" style={{ flex:"1.1" }}>
                  <select className="ctrl" value={m.timing || ""} onChange={e => setMed(i, "timing", e.target.value)}>
                    <option value="">Timing</option>
                    <option>Before Food</option>
                    <option>After Food</option>
                  </select>
                </div>
                <div className="sel" style={{ flex:".9" }}>
                  <select className="ctrl" value={m.duration} onChange={e => setMed(i, "duration", e.target.value)}>
                    <option value="">Duration</option>
                    {["3 Days","5 Days","7 Days","10 Days","15 Days","1 Month","2 Months","3 Months"]
                      .map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                {medicines.length > 1 && (
                  <button className="btn-rm" onClick={() => setMedicines(medicines.filter((_, x) => x !== i))}>✕</button>
                )}
              </div>
            ))}
            <button className="btn-add btn-add-p" onClick={() => setMedicines([...medicines, blankMed()])}>
              + Add Medicine
            </button>

            <div className="divider" />

            <label className="f-lbl">Laboratory Tests</label>
            {tests.map((t, i) => (
              <div key={i} style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
                <div className="sel" style={{ flex:1 }}>
                  <select className="ctrl" value={t} onChange={e => setTest(i, e.target.value)}>
                    <option value="">Select test…</option>
                    {testsList.map(x => <option key={x.id} value={x.name}>{x.name}</option>)}
                  </select>
                </div>
                {tests.length > 1 && (
                  <button className="btn-rm" onClick={() => setTests(tests.filter((_, x) => x !== i))}>✕</button>
                )}
              </div>
            ))}
            <button className="btn-add btn-add-s" onClick={() => setTests([...tests, ""])}>
              + Add Test
            </button>

            <button className="btn-save" onClick={handleSubmit}>
              Save Prescription
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
