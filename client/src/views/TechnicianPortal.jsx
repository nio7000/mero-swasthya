import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import apiClient from "../utils/api";
import { STORAGE_KEYS } from "../constants";
import Topbar from "../components/Topbar";

const CSS = `
/* LAYOUT */
.main{display:grid;grid-template-columns:360px 1fr;height:calc(100vh - 60px);overflow:hidden;}
.sidebar{background:var(--surface);border-right:2px solid var(--border);display:flex;flex-direction:column;overflow:hidden;}
.sidebar-top{padding:24px 28px 18px;border-bottom:2px solid var(--border);}
.sidebar-heading{font-family:var(--font-serif);font-size:18px;font-weight:600;color:var(--primary-dk);margin-bottom:4px;}
.sidebar-sub{font-size:13px;color:var(--text3);}
.sidebar-body{flex:1;overflow-y:auto;padding:20px 28px;}
.sidebar-body::-webkit-scrollbar{width:4px;}
.sidebar-body::-webkit-scrollbar-thumb{background:var(--border-dk);border-radius:3px;}

.content{display:flex;flex-direction:column;overflow-y:auto;}
.content::-webkit-scrollbar{width:5px;}
.content::-webkit-scrollbar-thumb{background:var(--border-dk);border-radius:3px;}
.content-top{padding:24px 36px 18px;border-bottom:2px solid var(--border);background:var(--surface);}
.content-heading{font-family:var(--font-serif);font-size:18px;font-weight:600;color:var(--primary-dk);margin-bottom:3px;}
.content-sub{font-size:13px;color:var(--text3);}
.content-body{padding:28px 36px;flex:1;}

.suggestions{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:50;overflow:hidden;}
.suggestion-item{padding:11px 16px;font-size:14px;cursor:pointer;transition:.1s;border-bottom:1px solid var(--border);color:var(--text2);}
.suggestion-item:last-child{border-bottom:none;}
.suggestion-item:hover{background:var(--primary-lt);color:var(--primary-dk);}

/* PATIENT CARD */
.patient-card{border:1.5px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:16px;cursor:pointer;transition:.15s;background:var(--surface);}
.patient-card:hover{border-color:var(--accent);background:var(--primary-lt);}
.patient-card.active{border-color:var(--accent);border-left:4px solid var(--accent);background:var(--primary-lt);}
.patient-name{font-size:15px;font-weight:600;color:var(--primary-dk);margin-bottom:4px;}
.patient-meta{font-size:12.5px;color:var(--text3);}
.test-count{display:inline-block;background:var(--primary-lt);color:var(--accent);font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:8px;}
.test-count.has-pending{background:var(--warn-lt);color:var(--warn);}

/* TEST TABLE */
.tbl-wrap{overflow-x:auto;border:1.5px solid var(--border);border-radius:10px;overflow:hidden;}

/* BUTTONS */
.btn-analyze{font-family:var(--font);font-size:12.5px;font-weight:600;padding:7px 14px;border-radius:5px;border:none;cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:6px;}
.btn-analyze.ready{background:var(--primary-dk);color:#fff;}
.btn-analyze.ready:hover{background:var(--primary);}
.btn-analyze.uploaded{background:var(--success-lt);color:var(--success);cursor:default;}
.btn-analyze.disabled{background:var(--surface2);color:var(--text3);cursor:not-allowed;border:1.5px solid var(--border);}
.btn-secondary{font-family:var(--font);font-size:14px;font-weight:600;background:var(--surface2);color:var(--text2);border:1.5px solid var(--border);border-radius:6px;padding:10px 22px;cursor:pointer;transition:.15s;}
.btn-secondary:hover{background:var(--border);}
.btn-success{font-family:var(--font);font-size:14px;font-weight:600;background:var(--success);color:#fff;border:none;border-radius:6px;padding:10px 22px;cursor:pointer;transition:.15s;}
.btn-success:hover{background:#1a7a40;}

/* EMPTY STATE */
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 40px;color:var(--text3);text-align:center;}
.empty-icon{font-size:48px;margin-bottom:16px;opacity:.5;}
.empty-title{font-family:var(--font-serif);font-size:18px;color:var(--text2);margin-bottom:6px;}
.empty-sub{font-size:13.5px;color:var(--text3);}

/* LOADING */
.loading-box{display:flex;align-items:center;justify-content:center;padding:60px;}
.spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin-right:16px;}
@keyframes spin{to{transform:rotate(360deg);}}

/* RESULT PANEL */
.result-panel{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:24px;}
.result-head{background:var(--primary-dk);padding:16px 22px;display:flex;justify-content:space-between;align-items:center;}
.result-head-title{font-family:var(--font-serif);font-size:16px;color:#fff;}
.result-head-sub{font-size:12px;color:#AED6F1;margin-top:2px;}
.result-body{padding:22px;}
.result-patient-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
.result-pitem{background:var(--surface2);border-radius:6px;padding:10px 14px;}
.result-pitem-lbl{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text3);margin-bottom:3px;}
.result-pitem-val{font-size:14px;font-weight:600;color:var(--text);}
.param-row-normal td{color:var(--text);}
.param-row-high td:last-child{color:var(--danger);font-weight:700;}
.param-row-low td:last-child{color:var(--warn);font-weight:700;}
.param-row-normal td:last-child{color:var(--success);font-weight:700;}
.result-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:16px;border-top:1px dashed var(--border);}

.sec-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);margin-bottom:12px;margin-top:24px;}
.sec-lbl:first-child{margin-top:0;}
`;

export default function TechnicianPortal() {
  const [search,          setSearch]          = useState("");
  const [suggestions,     setSuggestions]     = useState([]);
  const [patients,        setPatients]        = useState([]);
  const [activePatientData, setActivePatientData] = useState(null);
  const [showSugg,        setShowSugg]        = useState(false);
  const [tests,        setTests]        = useState([]);
  const [activePatient,setActivePatient]= useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [results,      setResults]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [allPatients,  setAllPatients]  = useState({});
  

  // Load all patients on mount for rich search
  useEffect(() => {
    apiClient.get("/patients/")
      .then(r => setPatients(r.data || []))
      .catch(() => {});
  }, []);

  const filteredPatients = patients.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return false;
    return (p.name||"").toLowerCase().includes(q) ||
           String(p.patient_id||"").toLowerCase().includes(q) ||
           String(p.contact||"").includes(q) ||
           (p.address||"").toLowerCase().includes(q);
  });

  const fetchTests = async (patient) => {
    const name = patient.name;
    setSearch(name); setSuggestions([]); setResults([]); setSelectedTest(null);
    try {
      const res = await apiClient.get(`/technician/tests/${encodeURIComponent(name)}`);
      const fetched = (res.data.tests||[]).map((t,i)=>({...t, sn:i+1}));
      setTests(fetched);
      setActivePatient(name);
      setActivePatientData(patient);
      setAllPatients(prev => ({ ...prev, [name]: fetched }));
    } catch { toast.error("Could not fetch tests"); }
  };

  const updateStatus = async (testId, newStatus) => {
    try {
      await apiClient.patch(`/technician/update-status/${testId}`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      if (activePatientData) fetchTests(activePatientData);
    } catch { toast.error("Failed to update status"); }
  };

  const handleFileSelect = async (test, e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSelectedTest(test);
    await handleAnalyze(files);
  };

  const handleAnalyze = async (files) => {
    try {
      setLoading(true); setResults([]);
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      const res = await apiClient.post("/analyze-reports/", fd);
      const data = res.data.results || [];
      setResults(data);
      if (!data.length) toast.warn("No analysis found");
      else toast.success("Analysis complete!");
    } catch { toast.error("Error analyzing file"); }
    finally { setLoading(false); }
  };

  const uploadResult = async (testId, report) => {
    try {
      const blob = new Blob([JSON.stringify(report)], { type:"application/json" });
      const fd = new FormData();
      fd.append("file", blob, "report.json");
      await apiClient.post(`/technician/upload-report/${testId}`, fd, {
        headers: { "Content-Type":"multipart/form-data" }
      });
      toast.success("Report uploaded successfully!");
      setTests(prev => prev.map(t => t.id===testId ? {...t, status:"Completed"} : t));
      setResults([]); setSelectedTest(null);
    } catch { toast.error("Failed to upload report"); }
  };

  const pendingCount = tests.filter(t => t.status !== "Completed" && t.payment_status === "Paid").length;

  return (
    <>
      <style>{CSS}</style>
      <ToastContainer position="top-right" autoClose={3000} />

      <Topbar role="Technician Dashboard" />

      <div className="main">
        {/* SIDEBAR — Patient Search */}
        <div className="sidebar">
          <div className="sidebar-top">
            <div className="sidebar-heading">Patient Search</div>
            <div className="sidebar-sub">Search by name to view assigned tests</div>
          </div>
          <div className="sidebar-body">
            <div className="search-wrap" style={{marginBottom:20,position:"relative"}}>
              <input
                className="search-input"
                placeholder="Search by name, ID or contact…"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowSugg(true); }}
                onBlur={() => setTimeout(() => setShowSugg(false), 160)}
              />
              {showSugg && search.trim() && filteredPatients.length > 0 && (
                <div className="drop">
                  {filteredPatients.map(p => (
                    <div key={p.id} className="drop-item" onMouseDown={() => { fetchTests(p); setShowSugg(false); }}>
                      <span style={{fontWeight:600}}>{p.name}</span>
                      <span style={{color:"var(--text3)",fontSize:12.5,marginLeft:8}}>
                        {p.patient_id}{p.age ? ` · ${p.age}y` : ""}{p.sex ? ` · ${p.sex}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {activePatient && tests.length > 0 && (
              <>
                <div className="sec-lbl">Current Patient</div>
                <div className="patient-card active">
                  <div className="patient-name">
                    {activePatient}
                    <span className={`test-count ${pendingCount > 0 ? "has-pending" : ""}`}>
                      {pendingCount > 0 ? `${pendingCount} pending` : `${tests.length} tests`}
                    </span>
                  </div>
                  <div className="patient-meta">
                    {activePatientData && (
                      <span>{activePatientData.patient_id}{activePatientData.age ? ` · ${activePatientData.age}y` : ""}{activePatientData.sex ? ` · ${activePatientData.sex}` : ""}</span>
                    )}
                    {!activePatientData && <span>{tests.length} test{tests.length!==1?"s":""} assigned</span>}
                  </div>
                </div>

                <div className="sec-lbl" style={{marginTop:20}}>Test Summary</div>
                {tests.map(t => (
                  <div key={t.id} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"10px 0",borderBottom:"1px solid var(--border)",fontSize:13.5
                  }}>
                    <span style={{color:"var(--text2)",fontWeight:500}}>{t.test_name}</span>
                    <span className={`badge ${t.status==="Completed"?"b-done":"b-pending"}`}>
                      {t.status==="Completed"?"Done":"Pending"}
                    </span>
                  </div>
                ))}
              </>
            )}

            {!activePatient && (
              <div style={{textAlign:"center",paddingTop:40,color:"var(--text3)"}}>
                <div style={{fontSize:36,marginBottom:12,opacity:.4}}>🔬</div>
                <div style={{fontSize:13.5}}>Search for a patient to view their assigned lab tests</div>
              </div>
            )}
          </div>
        </div>

        {/* CONTENT — Test Table + Results */}
        <div className="content">
          {!activePatient ? (
            <div className="empty-state">
              <div className="empty-icon">🧪</div>
              <div className="empty-title">No Patient Selected</div>
              <div className="empty-sub">Search for a patient on the left to view and manage their lab tests.</div>
            </div>
          ) : (
            <>
              <div className="content-top">
                <div className="content-heading">Tests for {activePatient}</div>
                <div className="content-sub">{tests.length} test{tests.length!==1?"s":""} · {pendingCount} awaiting upload</div>
              </div>

              <div className="content-body">
                {/* Test Table */}
                <div className="tbl-wrap" style={{marginBottom:28}}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        {["S.N.","Test Name","Requested At","Payment","Status","Action"].map(h=>(
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tests.map(t => {
                        const isUploaded  = t.status === "Completed";
                        const isUnpaid    = t.payment_status !== "Paid";
                        const btnCls      = isUploaded ? "uploaded" : isUnpaid ? "disabled" : "ready";
                        const btnLabel    = isUploaded ? "✓ Uploaded" : isUnpaid ? "Unpaid" : "Analyze Report";
                        return (
                          <tr key={t.id}>
                            <td style={{color:"var(--text3)",fontSize:13}}>{t.sn}</td>
                            <td style={{fontWeight:600}}>{t.test_name}</td>
                            <td style={{fontSize:13,color:"var(--text3)"}}>{t.created_at||"—"}</td>
                            <td><span className={`badge ${t.payment_status==="Paid"?"b-paid":"b-unpaid"}`}>{t.payment_status==="Paid"?"Paid":"Unpaid"}</span></td>
                            <td><span className={`badge ${isUploaded?"b-done":"b-pending"}`}>{isUploaded?"Done":"Pending"}</span></td>
                            <td>
                              <label className={`btn-analyze ${btnCls}`} style={{pointerEvents: isUploaded||isUnpaid?"none":"auto"}}>
                                {btnLabel}
                                <input type="file" style={{display:"none"}} disabled={isUploaded||isUnpaid} onChange={e=>handleFileSelect(t,e)} />
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Loading */}
                {loading && (
                  <div className="loading-box">
                    <div className="spinner"/>
                    <div>
                      <div style={{fontFamily:"var(--font-serif)",fontSize:16,color:"var(--primary-dk)"}}>Analyzing Report</div>
                      <div style={{fontSize:13,color:"var(--text3)",marginTop:3}}>Running OCR and medical value extraction…</div>
                    </div>
                  </div>
                )}

                {/* Results */}
                {!loading && results.length > 0 && selectedTest && (
                  <>
                    <div className="sec-lbl">AI Report Preview — {selectedTest.test_name}</div>
                    {results.map((r,i) => {
                      const analysis = r.medical_analysis || {};
                      const s = r.structured_data || {};
                      const hasAnalysis = Object.keys(analysis).length > 0;
                      return (
                        <div key={i} className="result-panel">
                          <div className="result-head">
                            <div>
                              <div className="result-head-title">AI Medical Analysis</div>
                              <div className="result-head-sub">{selectedTest.test_name} · OCR extraction complete</div>
                            </div>
                            <span className="badge b-done" style={{background:"rgba(255,255,255,.15)",color:"#AED6F1"}}>Ready to Upload</span>
                          </div>
                          <div className="result-body">
                            {/* Patient info */}
                            <div className="result-patient-grid">
                              {[["Patient Name", s["Patient Name"]||"—"],["Age", s["Age"]||"—"],["Sex", s["Sex"]||"—"]].map(([lbl,val])=>(
                                <div key={lbl} className="result-pitem">
                                  <div className="result-pitem-lbl">{lbl}</div>
                                  <div className="result-pitem-val">{val}</div>
                                </div>
                              ))}
                            </div>

                            {/* Analysis table */}
                            {hasAnalysis ? (
                              <div className="tbl-wrap">
                                <table className="tbl">
                                  <thead>
                                    <tr>{["Parameter","Value","Unit","Normal Range","Status"].map(h=><th key={h}>{h}</th>)}</tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(analysis).map(([key,val],j) => {
                                      const rowCls = val.status==="High"?"param-row-high":val.status==="Low"?"param-row-low":"param-row-normal";
                                      return (
                                        <tr key={j} className={rowCls}>
                                          <td style={{fontWeight:600}}>{key}</td>
                                          <td>{val.value}</td>
                                          <td style={{color:"var(--text3)"}}>{val.unit}</td>
                                          <td style={{color:"var(--text3)"}}>{val.range}</td>
                                          <td>{val.status}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div style={{padding:"20px 0",color:"var(--text3)",fontSize:14,fontStyle:"italic"}}>
                                No structured medical values extracted. Report will be uploaded as raw OCR text.
                              </div>
                            )}

                            <div className="result-actions">
                              <button className="btn-secondary" onClick={() => { setResults([]); setSelectedTest(null); }}>Cancel</button>
                              <button className="btn-success" onClick={() => uploadResult(selectedTest.id, r)}>Upload Report</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
