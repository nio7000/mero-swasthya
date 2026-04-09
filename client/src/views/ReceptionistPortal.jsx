import React, { useState, useEffect, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import QRCode from "react-qr-code";
import apiClient, { authHeader } from "../utils/api";
import { STORAGE_KEYS, FEES, PHONE_REGEX, HOSPITAL_NAME, HOSPITAL_ADDR, HOSPITAL_PHONE } from "../constants";
import Topbar from "../components/Topbar";

/* ── helpers ── */
const blankForm = () => ({ name:"", age:"", sex:"", contact:"", address:"", visitReason:"", assignedDoctor:null, paymentMethod:"cash" });

const assignDoctorFromDB = async (visitReason) => {
  try {
    const res = await apiClient.post("/ai/assign-doctor/", { reason: visitReason });
    return res.data;
  } catch { return null; }
};

/* ── CSS ── */
const CSS = `
.pid-chip{display:flex;align-items:center;gap:12px;background:var(--primary-lt);border:1px solid #AED6F1;border-radius:6px;padding:10px 16px;margin-bottom:20px;}
.pid-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--accent);}
.pid-val{font-size:17px;font-weight:700;color:var(--primary-dk);font-family:var(--font-serif);}
.mode-tabs{display:flex;gap:0;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:24px;}
.mode-tab{flex:1;padding:11px;font-family:var(--font);font-size:13.5px;font-weight:600;border:none;cursor:pointer;transition:.15s;background:var(--surface2);color:var(--text3);}
.mode-tab.active{background:var(--primary-dk);color:#fff;}
.mode-tab:first-child{border-right:1.5px solid var(--border);}
.fu-lookup{border:1.5px solid var(--border);border-radius:10px;overflow:hidden;}
.fu-lookup-head{background:var(--surface2);padding:16px 20px;border-bottom:1.5px solid var(--border);}
.fu-lookup-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--primary);margin-bottom:4px;}
.fu-lookup-sub{font-size:13px;color:var(--text3);}
.fu-lookup-body{padding:20px;}
.patient-card{background:var(--primary-lt);border:1.5px solid #AED6F1;border-radius:8px;padding:16px 18px;margin-top:16px;}
.patient-card-name{font-family:var(--font-serif);font-size:18px;font-weight:600;color:var(--primary-dk);margin-bottom:8px;}
.patient-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.patient-card-item{}
.patient-card-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--accent);margin-bottom:2px;}
.patient-card-val{font-size:14px;color:var(--text);}
.followup-banner{display:flex;align-items:flex-start;gap:14px;background:var(--success-lt);border:1.5px solid #A9DFBF;border-left:4px solid var(--success);border-radius:8px;padding:14px 18px;margin-top:16px;}
.followup-banner-icon{font-size:22px;flex-shrink:0;}
.followup-banner-title{font-size:14px;font-weight:700;color:var(--success);margin-bottom:3px;}
.followup-banner-sub{font-size:13px;color:#1a5c34;}
.not-found-box{background:var(--danger-lt);border:1.5px solid #F5B7B1;border-radius:8px;padding:14px 18px;margin-top:16px;font-size:13.5px;color:var(--danger);}
.doctor-box{margin-top:10px;border:1.5px solid var(--border);border-left:4px solid var(--accent);border-radius:6px;padding:14px 16px;background:var(--surface2);}
.doctor-box-tag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--accent);margin-bottom:6px;}
.doctor-box-name{font-size:16px;font-weight:700;color:var(--primary-dk);}
.doctor-box-spec{font-size:13px;color:var(--accent);font-weight:500;margin-top:2px;}
.doctor-box-reason{font-size:12.5px;color:var(--text3);margin-top:5px;font-style:italic;}
.ai-typing{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text3);margin-top:10px;}
.ai-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);animation:bounce .8s infinite;}
.ai-dot:nth-child(2){animation-delay:.15s;}
.ai-dot:nth-child(3){animation-delay:.3s;}
@keyframes bounce{0%,80%,100%{transform:scale(0);}40%{transform:scale(1);}}
.fee-box{display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1.5px solid var(--border);border-radius:6px;padding:13px 16px;margin-top:16px;}
.fee-box.free{background:var(--success-lt);border-color:#A9DFBF;}
.fee-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);}
.fee-box.free .fee-label{color:var(--success);}
.fee-val{font-size:20px;font-weight:700;color:var(--primary-dk);}
.fee-box.free .fee-val{color:var(--success);}
.pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;}
.pay-btn{padding:12px;border-radius:6px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text2);font-family:var(--font);font-size:14px;font-weight:600;cursor:pointer;transition:.15s;}
.pay-btn.active{border-color:var(--accent);background:var(--primary-lt);color:var(--primary-dk);}
.qr-confirmed{font-size:13px;color:var(--accent);font-weight:600;margin-top:8px;padding:8px 12px;background:var(--primary-lt);border-radius:5px;border:1px solid #AED6F1;}
.f-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.f-lbl{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text2);margin-bottom:6px;margin-top:16px;}
.f-lbl:first-child{margin-top:0;}
.ctrl:read-only{background:#F0F4F8;color:var(--text2);cursor:default;}
.btn-register{width:100%;padding:14px;background:var(--primary-dk);color:#fff;border:none;border-radius:6px;font-family:var(--font);font-size:15px;font-weight:700;cursor:pointer;letter-spacing:.3px;transition:.15s;box-shadow:0 3px 10px rgba(21,67,96,.25);margin-top:20px;}
.btn-register:hover{background:var(--primary);}
.btn-register:disabled{background:var(--border-dk);cursor:not-allowed;box-shadow:none;}
.btn-register.success-btn{background:var(--success);}
.btn-register.success-btn:hover{background:#1a7a40;}
.inv-section-head{display:flex;align-items:center;justify-content:space-between;margin-top:28px;margin-bottom:10px;}
.inv-section-lbl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);}
.btn-print{font-family:var(--font);font-size:13px;font-weight:600;background:var(--primary-dk);color:#fff;border:none;border-radius:4px;padding:6px 16px;cursor:pointer;transition:.15s;}
.btn-print:hover{background:var(--primary);}
.sec-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.tbl-wrap{overflow-x:auto;}
.tbl-empty{text-align:center;padding:48px;color:var(--text3);font-size:14px;}
.search-input{padding:10px 14px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font);font-size:14px;color:var(--text);background:var(--surface2);outline:none;width:300px;transition:.15s;}
.search-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(46,134,193,.12);background:#fff;}
.search-input::placeholder{color:var(--text3);}
.modal-sub{font-size:13px;color:var(--text3);margin-bottom:20px;}
.modal-amount{font-size:17px;color:var(--text2);margin:18px 0;}
@media(max-width:1024px){
  .workspace{grid-template-columns:1fr;height:auto;}
  .panel{border-right:none;border-bottom:2px solid var(--border);}
  .scroll{max-height:none;}
}
`;

/* ── Invoice Card ── */
const InvoiceCard = ({ invoice }) => {
  if (!invoice) return null;
  const isFree   = invoice.isFollowUp;
  const isSelfFu = invoice.isSelfFollowUp;
  const feeAmt   = isFree ? 0 : isSelfFu ? FEES.SELF : FEES.CONSULT;
  const drName   = invoice.doctorName || "";
  const drSpec   = invoice.specialization || "";
  const descLine = isFree
    ? ("Follow-up Visit" + (drName ? " (Dr. " + drName + (drSpec ? " — " + drSpec : "") + ")" : ""))
    : isSelfFu
    ? "Self Follow-up Visit"
    : ("Consultation Fee" + (drName ? " (Dr. " + drName + (drSpec ? " — " + drSpec : "") + ")" : ""));
  const invNo    = "INV-" + String(invoice.invNumber || invoice.patientId.replace("PA","")).padStart(4,"0");
  const payDisp  = (invoice.paymentMethod || "cash").toUpperCase();
  const staffEmail = localStorage.getItem(STORAGE_KEYS.EMAIL) || "Receptionist";

  return (
    <div className="inv-wrap">
      <div className="inv-head">
        <div className="inv-logo-row">
          <div className="inv-logo">🏥</div>
          <div>
            <div className="inv-hospital">{HOSPITAL_NAME}</div>
            <div className="inv-meta">{HOSPITAL_ADDR}<br/>{HOSPITAL_PHONE}</div>
          </div>
        </div>
        <div className="inv-badges">
          <div className="inv-badge">
            <div className="inv-badge-label">Invoice No.</div>
            <div className="inv-badge-val">{invNo}</div>
          </div>
          <div className="inv-badge">
            <div className="inv-badge-label">Date</div>
            <div className="inv-badge-val" style={{fontSize:14}}>{invoice.date}</div>
          </div>
        </div>
      </div>

      <div className="inv-body">
        <div className="inv-patient-row">
          <div>
            <div className="inv-patient-lbl">Bill To</div>
            <div className="inv-patient-name">{invoice.name}</div>
            <div className="inv-patient-sub">{invoice.visitReason}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="inv-patient-lbl">Patient ID</div>
            <div className="inv-patient-name">{invoice.patientId}</div>
          </div>
        </div>

        <div style={{border:"1.5px solid var(--border)",borderRadius:6,overflow:"hidden"}}>
          <table className="inv-tbl">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th style={{textAlign:"right"}}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{descLine}</td>
                <td>1</td>
                <td>Rs. {feeAmt}</td>
                <td style={{textAlign:"right"}}>
                  {isFree
                    ? <span><span style={{textDecoration:"line-through",color:"var(--text3)",marginRight:8}}>Rs. {FEES.CONSULT}</span><span style={{color:"var(--success)",fontWeight:600}}>Rs. 0</span></span>
                    : <>Rs. {feeAmt}</>
                  }
                </td>
              </tr>
              {isFree && (
                <tr style={{background:"#F0FDF4"}}>
                  <td colSpan={4} style={{color:"var(--success)",fontSize:13,fontWeight:600}}>
                    ✓ Follow-up Visit — Assigned by Dr. {invoice.followupBy} — Fully Waived
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inv-total-box">
          <div className="inv-total-row"><span>Subtotal</span><span>Rs. {feeAmt}</span></div>
          <div className="inv-total-grand">
            <span>Grand Total</span>
            <span style={{color: isFree ? "var(--success)" : "var(--primary-dk)"}}>
              Rs. {isFree ? "0.00" : feeAmt + ".00"}
            </span>
          </div>
          <div className="inv-pay-note">Payment Method: <strong>{payDisp}</strong></div>
        </div>
      </div>

      <div className="inv-foot">Generated by <strong>Receptionist ({staffEmail})</strong></div>
    </div>
  );
};

/* ── Main Component ── */
export default function ReceptionistPortal() {
  const [mode,        setMode]        = useState("new");
  const [formData,    setFormData]    = useState(blankForm());
  const [patientId,   setPatientId]   = useState("");
  const [loading,     setLoading]     = useState(false);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [patients,    setPatients]    = useState([]);
  const [filtered,    setFiltered]    = useState([]);
  const [search,      setSearch]      = useState("");
  const [doctors,     setDoctors]     = useState([]);
  const [showQR,      setShowQR]      = useState(false);
  const [qrPaid,      setQrPaid]      = useState(false);
  const [selfFollowup,setSelfFollowup] = useState(false);
  const [fuQrPaid,    setFuQrPaid]    = useState(false);
  const [fuShowQR,    setFuShowQR]    = useState(false);
  const [fuPayMethod, setFuPayMethod] = useState("cash");
  const [invoice,     setInvoice]     = useState(null);
  const [aiResult,    setAiResult]    = useState(null);

  const [fuContact,   setFuContact]   = useState("");
  const [fuPatient,   setFuPatient]   = useState(null);
  const [fuInfo,      setFuInfo]      = useState(null);
  const [fuChecking,  setFuChecking]  = useState(false);
  const [fuAiResult,  setFuAiResult]  = useState(null);
  const [fuVisitReason, setFuVisitReason] = useState("");
  const [fuAiLoading, setFuAiLoading] = useState(false);

  const debounceRef   = useRef(null);
  const fuDebounceRef = useRef(null);

  useEffect(() => { fetchNextId(); fetchPatients(); fetchDoctors(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(patients.filter(p =>
      p.name.toLowerCase().includes(q)    ||
      p.contact.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      p.patient_id.toLowerCase().includes(q)
    ));
  }, [search, patients]);

  /* AI for new patient */
  useEffect(() => {
    const reason = formData.visitReason.trim();
    if (!reason || reason.length < 5 || !doctors.length) { setAiResult(null); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setAiLoading(true);
      const result = await assignDoctorFromDB(reason);
      setAiResult(result);
      setFormData(prev => ({ ...prev, assignedDoctor: result }));
      setAiLoading(false);
    }, 900);
    return () => clearTimeout(debounceRef.current);
  }, [formData.visitReason, doctors]);

  /* Auto-assign original doctor when follow-up found */
  useEffect(() => {
    if (!fuInfo?.has_followup || !fuInfo?.assigned_by) { setFuAiResult(null); return; }
    const matched = doctors.find(d =>
      d.full_name?.toLowerCase().includes(fuInfo.assigned_by.toLowerCase()) ||
      fuInfo.assigned_by.toLowerCase().includes(d.full_name?.split(" ")[0]?.toLowerCase())
    );
    setFuAiResult({
      doctor_name:    matched?.full_name || fuInfo.assigned_by,
      doctor_id:      matched?.id || null,
      specialization: matched?.specialization || "—",
      reason:         "Auto-assigned — original follow-up doctor",
    });
  }, [fuInfo, doctors]);

  const fetchNextId = async () => {
    try { const res = await apiClient.get("/next-patient-id/"); setPatientId(res.data.patient_id); }
    catch { setPatientId("PA000001"); }
  };

  const fetchPatients = async () => {
    try { const res = await apiClient.get("/patients/"); setPatients(res.data); setFiltered(res.data); }
    catch { toast.error("Failed to load patients."); }
  };

  const fetchDoctors = async () => {
    try { const res = await apiClient.get("/doctors/"); setDoctors(res.data.doctors || []); }
    catch { /* silent */ }
  };

  const setField = (f, v) => setFormData(prev => ({ ...prev, [f]: v }));

  /* Follow-up contact lookup */
  useEffect(() => {
    if (!/^(98|97)\d{8}$/.test(fuContact)) {
      setFuPatient(null); setFuInfo(null); return;
    }
    const existing = patients.find(p => p.contact === fuContact);
    if (!existing) { setFuPatient(null); setFuInfo(null); return; }
    setFuPatient(existing);
    (async () => {
      setFuChecking(true);
      try {
        const res = await apiClient.get(`/followup/check/${existing.id}`);
        setFuInfo(res.data);
      } catch { setFuInfo(null); }
      finally { setFuChecking(false); }
    })();
  }, [fuContact, patients]);

  /* ── Register new patient ── */
  const handleRegister = async () => {
    const { name, age, sex, contact, address, visitReason, paymentMethod, assignedDoctor } = formData;
    if (!name || !age || !sex || !contact || !address || !visitReason)
      return toast.warn("Please fill all fields including reason for visit.");
    if (!/^(98|97)\d{8}$/.test(contact))
      return toast.error("Enter a valid 10-digit Nepali phone number.");
    if (patients.some(p => p.contact === contact))
      return toast.error("This phone number is already registered.");
    if (!paymentMethod)
      return toast.error("Please select a payment method.");
    if (paymentMethod === "qr" && !qrPaid)
      return toast.error("Complete QR payment before registering.");
    if (!assignedDoctor)
      return toast.warn("Please wait for doctor assignment.");

    try {
      setLoading(true);
      await apiClient.post("/register-patient/", { ...formData, patient_id: patientId });

      const patientsRes = await apiClient.get("/patients/");
      const newPatient  = (patientsRes.data || []).find(p => p.contact === contact);
      let invNumber = patientId;

      if (newPatient) {
        try {
          const drName = formData.assignedDoctor?.doctor_name || assignedDoctor?.doctor_name || "";
          const drSpec = formData.assignedDoctor?.specialization || assignedDoctor?.specialization || "";
          const billRes = await apiClient.post("/counter/consultation-bill/", {
            patient_id:     newPatient.id,
            payment_method: paymentMethod,
            doctor_name:    drName,
            specialization: drSpec,
          });
          if (billRes.data?.bill_id) {
            invNumber = String(billRes.data.bill_id).padStart(5, "0");
          }
        } catch { /* bill creation optional — don't block registration */ }
      }

      const now = new Date().toLocaleString("en-US", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
      setInvoice({
        patientId, name, visitReason, invNumber,
        doctorName:     assignedDoctor.doctor_name,
        specialization: assignedDoctor.specialization,
        paymentMethod,
        isFollowUp: false,
        date: now,
      });
      toast.success("Patient registered successfully.");
      setFormData(blankForm()); setAiResult(null); setQrPaid(false);
      fetchNextId(); fetchPatients();
    } catch { toast.error("Failed to register patient."); }
    finally { setLoading(false); }
  };

  /* ── Register follow-up visit ── */
  const handleFollowUpRegister = async () => {
    if (!fuPatient) return toast.warn("No patient found for this contact number.");
    if (!fuInfo?.has_followup) return toast.warn("This patient has no active follow-up.");

    try {
      setLoading(true);
      await apiClient.post(`/followup/use/${fuPatient.id}`, {});

      let fuInvNumber = fuPatient.patient_id;
      const fuDrName = fuAiResult?.doctor_name || fuInfo?.assigned_by || "";
      const fuDrSpec = fuAiResult?.specialization || "";
      try {
        const fuBillRes = await apiClient.post("/counter/consultation-bill/", {
          patient_id:     fuPatient.id,
          payment_method: "follow-up",
          doctor_name:    fuDrName,
          specialization: fuDrSpec,
          amount:         0,
        });
        if (fuBillRes.data?.bill_id) fuInvNumber = String(fuBillRes.data.bill_id).padStart(5,"0");
      } catch { /* non-blocking */ }

      const now = new Date().toLocaleString("en-US", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
      setInvoice({
        patientId: fuPatient.patient_id,
        invNumber: fuInvNumber,
        name:           fuPatient.name,
        visitReason:    "Follow-up visit",
        doctorName:     fuDrName,
        specialization: fuDrSpec,
        isFollowUp:     true,
        followupBy:     fuInfo.assigned_by,
        paymentMethod:  "Follow-up (Free)",
        date: now,
      });

      toast.success("Follow-up visit registered — no charge.");
      setFuContact(""); setFuPatient(null); setFuInfo(null);
      setFuVisitReason(""); setFuAiResult(null);
      fetchNextId(); fetchPatients();
    } catch { toast.error("Failed to register follow-up visit."); }
    finally { setLoading(false); }
  };

  const handleSelfFollowUpRegister = async () => {
    if (!fuPatient) return toast.warn("No patient found.");
    if (!fuPayMethod) return toast.error("Please select a payment method.");
    if (fuPayMethod === "qr" && !fuQrPaid) return toast.error("Complete QR payment first.");
    try {
      setLoading(true);
      let selfInvNumber = fuPatient.patient_id;
      try {
        const selfBillRes = await apiClient.post("/counter/consultation-bill/", {
          patient_id:     fuPatient.id,
          payment_method: fuPayMethod,
          doctor_name:    "",
          specialization: "",
          amount:         FEES.SELF,
          description:    "Self Follow-up Visit",
        });
        if (selfBillRes.data?.bill_id) selfInvNumber = String(selfBillRes.data.bill_id).padStart(5,"0");
      } catch { /* non-blocking */ }
      const now = new Date().toLocaleString("en-US", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
      setInvoice({
        patientId:     fuPatient.patient_id,
        invNumber:     selfInvNumber,
        name:          fuPatient.name,
        visitReason:   "Self Follow-up Visit",
        doctorName:    "",
        specialization:"",
        isFollowUp:    false,
        isSelfFollowUp:true,
        paymentMethod: fuPayMethod,
        date: now,
      });
      toast.success("Self follow-up registered — Rs. " + FEES.SELF + " charged.");
      setSelfFollowup(false); setFuContact(""); setFuPatient(null); setFuInfo(null);
      setFuQrPaid(false); setFuPayMethod("cash");
      fetchNextId(); fetchPatients();
    } catch { toast.error("Failed to register self follow-up."); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    const el = document.getElementById("consult-invoice-print");
    if (!el) return;
    const printCSS = `
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      :root{--primary:#1B4F72;--primary-dk:#154360;--primary-lt:#D6EAF8;--accent:#2E86C1;--success:#1E8449;--success-lt:#D5F5E3;--border:#CDD5DF;--text:#1A202C;--text2:#374151;--text3:#6B7280;--surface:#fff;--surface2:#F4F6F9;--font:'IBM Plex Sans',sans-serif;--font-serif:'IBM Plex Serif',serif;}
      body{font-family:var(--font);font-size:14px;color:var(--text);background:#fff;padding:24px;}
      .inv-wrap{border-radius:10px;overflow:hidden;border:1.5px solid var(--border);}
      .inv-head{background:var(--primary-dk);padding:22px 28px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .inv-logo-row{display:flex;align-items:center;gap:14px;}
      .inv-logo{width:48px;height:48px;background:rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .inv-hospital{font-family:var(--font-serif);font-size:19px;color:#fff;margin-bottom:3px;}
      .inv-meta{font-size:12.5px;color:#AED6F1;line-height:1.7;}
      .inv-badges{display:flex;flex-direction:column;gap:8px;flex-shrink:0;}
      .inv-badge{background:rgba(255,255,255,.15);padding:9px 14px;border-radius:6px;text-align:right;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .inv-badge-label{font-size:10px;color:#AED6F1;text-transform:uppercase;letter-spacing:.7px;margin-bottom:2px;}
      .inv-badge-val{font-size:16px;font-weight:700;color:#fff;}
      .inv-body{padding:24px 28px;}
      .inv-patient-row{display:flex;justify-content:space-between;margin-bottom:20px;}
      .inv-patient-lbl{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#6B7280;margin-bottom:4px;}
      .inv-patient-name{font-size:16px;font-weight:600;color:#1A202C;}
      .inv-patient-sub{font-size:13px;color:#6B7280;}
      .inv-tbl{width:100%;border-collapse:collapse;font-size:14px;}
      .inv-tbl th{padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#374151;border-bottom:1.5px solid #CDD5DF;background:#E8EEF5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .inv-tbl td{padding:10px 12px;border-bottom:1px solid #CDD5DF;color:#1A202C;}
      .inv-tbl tr:last-child td{border-bottom:none;}
      .inv-total-box{max-width:280px;margin-left:auto;margin-top:18px;padding:16px 18px;border:1.5px solid #CDD5DF;border-radius:8px;}
      .inv-total-row{display:flex;justify-content:space-between;font-size:14px;margin-bottom:7px;}
      .inv-total-grand{font-size:16px;font-weight:700;color:#154360;border-top:1.5px solid #CDD5DF;padding-top:10px;margin-top:8px;display:flex;justify-content:space-between;}
      .inv-pay-note{font-size:12px;color:#6B7280;border-top:1px dashed #CDD5DF;margin-top:10px;padding-top:10px;}
      .inv-foot{padding:14px 28px;border-top:1.5px solid #CDD5DF;font-size:13px;color:#6B7280;}
    `;
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position:"absolute", width:"0", height:"0", border:"none" });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<html><head><title>Consultation Invoice</title><style>${printCSS}</style></head><body>${el.innerHTML}</body></html>`);
    doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 400);
  };

  const fuHasFollowup = fuInfo?.has_followup === true;
  const fuNoFollowup  = fuPatient && fuInfo && !fuInfo.has_followup;

  return (
    <>
      <style>{CSS}</style>
      <ToastContainer position="top-right" autoClose={3000} />

      <Topbar role="Receptionist Portal" />

      <div className="workspace" style={{gridTemplateColumns:"500px 1fr"}}>

        {/* ── LEFT PANEL ── */}
        <div className="panel">
          <div className="panel-top">
            <div className="panel-heading">Patient Registration</div>
            <div className="panel-sub">Register new patients or process follow-up visits</div>
          </div>

          <div className="scroll">

            {/* Mode switcher */}
            <div className="mode-tabs">
              <button className={`mode-tab ${mode==="new"?"active":""}`} onClick={() => { setMode("new"); setInvoice(null); }}>
                New Patient
              </button>
              <button className={`mode-tab ${mode==="followup"?"active":""}`} onClick={() => { setMode("followup"); setInvoice(null); }}>
                Follow-up Visit
              </button>
            </div>

            {/* ════ NEW PATIENT MODE ════ */}
            {mode === "new" && (
              <>
                <div className="pid-chip">
                  <span className="pid-label">Patient ID</span>
                  <span className="pid-val">{patientId}</span>
                </div>

                <div className="f-grid2">
                  <div>
                    <label className="f-lbl">Full Name</label>
                    <input className="ctrl" placeholder="Full name…" value={formData.name} onChange={e => setField("name", e.target.value)} />
                  </div>
                  <div>
                    <label className="f-lbl">Age</label>
                    <input className="ctrl" type="number" placeholder="Age…" value={formData.age} onChange={e => setField("age", e.target.value)} />
                  </div>
                </div>

                <div className="f-grid2" style={{marginTop:14}}>
                  <div>
                    <label className="f-lbl">Sex</label>
                    <div className="sel">
                      <select className="ctrl" value={formData.sex} onChange={e => setField("sex", e.target.value)}>
                        <option value="">Select…</option>
                        <option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="f-lbl">Contact Number</label>
                    <input className="ctrl" placeholder="98XXXXXXXX" value={formData.contact}
                      onChange={e => { if (PHONE_REGEX.test(e.target.value)) setField("contact", e.target.value); }} />
                  </div>
                </div>

                <label className="f-lbl">Address</label>
                <input className="ctrl" placeholder="Patient address…" value={formData.address} onChange={e => setField("address", e.target.value)} />

                <div className="divider" />

                <label className="f-lbl">Reason for Visit</label>
                <textarea className="ctrl" rows={3}
                  placeholder="Describe symptoms…"
                  value={formData.visitReason}
                  onChange={e => setField("visitReason", e.target.value)}
                  style={{resize:"none"}} />

                {aiLoading && (
                  <div className="ai-typing">
                    <div className="ai-dot"/><div className="ai-dot"/><div className="ai-dot"/>
                    <span>Analyzing and assigning doctor…</span>
                  </div>
                )}
                {aiResult && !aiLoading && (
                  <div className="doctor-box">
                    <div className="doctor-box-tag">Assigned Doctor</div>
                    <div className="doctor-box-name">Dr. {aiResult.doctor_name}</div>
                    <div className="doctor-box-spec">{aiResult.specialization}</div>
                    <div className="doctor-box-reason">{aiResult.reason}</div>
                  </div>
                )}

                <div className="divider" />

                <div className="fee-box">
                  <div>
                    <div className="fee-label">Consultation Fee</div>
                    <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>Fixed rate per visit</div>
                  </div>
                  <div className="fee-val">Rs. {FEES.CONSULT}</div>
                </div>

                <label className="f-lbl" style={{marginTop:16}}>Payment Method</label>
                <div className="pay-grid">
                  <button
                    className={`pay-btn ${formData.paymentMethod==="cash"?"active":""}`}
                    onClick={() => { if (!qrPaid) setField("paymentMethod","cash"); }}
                    disabled={qrPaid}
                    style={{opacity: qrPaid ? 0.45 : 1, cursor: qrPaid ? "not-allowed" : "pointer"}}
                  >Cash</button>
                  <button
                    className={`pay-btn ${formData.paymentMethod==="qr"?"active":""}`}
                    onClick={() => { if (!qrPaid) { setField("paymentMethod","qr"); setShowQR(true); } }}
                    disabled={qrPaid}
                    style={{opacity: qrPaid ? 1 : 1, cursor: qrPaid ? "not-allowed" : "pointer"}}
                  >QR Payment</button>
                </div>
                {formData.paymentMethod==="qr" && qrPaid && (
                  <div className="qr-confirmed">✓ QR Payment confirmed — locked</div>
                )}

                <button className="btn-register" onClick={handleRegister} disabled={loading}>
                  {loading ? "Registering…" : "Register Patient"}
                </button>
              </>
            )}

            {/* ════ FOLLOW-UP MODE ════ */}
            {mode === "followup" && (
              <>
                <div className="fu-lookup">
                  <div className="fu-lookup-head">
                    <div className="fu-lookup-title">Follow-up Lookup</div>
                    <div className="fu-lookup-sub">Enter the patient's contact number to check their follow-up status</div>
                  </div>
                  <div className="fu-lookup-body">
                    <label className="f-lbl" style={{marginTop:0}}>Contact Number</label>
                    <input
                      className="ctrl"
                      placeholder="98XXXXXXXX"
                      value={fuContact}
                      onChange={e => { if (PHONE_REGEX.test(e.target.value)) { setFuContact(e.target.value); setFuVisitReason(""); setFuAiResult(null); } }}
                      autoFocus
                    />

                    {fuChecking && (
                      <div className="ai-typing" style={{marginTop:10}}>
                        <div className="ai-dot"/><div className="ai-dot"/><div className="ai-dot"/>
                        <span>Checking follow-up status…</span>
                      </div>
                    )}

                    {/* Patient not found */}
                    {fuContact.length===10 && !fuPatient && !fuChecking && (
                      <div className="not-found-box">
                        No patient found with this contact number. Please use New Patient registration.
                      </div>
                    )}

                    {/* Patient found but no follow-up — offer self-follow-up */}
                    {fuNoFollowup && (
                      <>
                        <div className="patient-card" style={{borderColor:"#F5B7B1",background:"var(--danger-lt)"}}>
                          <div className="patient-card-name" style={{color:"var(--danger)"}}>{fuPatient.name}</div>
                          <div style={{fontSize:13,color:"var(--danger)"}}>No active follow-up assigned by a doctor.</div>
                        </div>
                        <div style={{marginTop:14,padding:"16px 18px",border:"1.5px solid var(--border)",borderRadius:8,background:"var(--warn-lt)"}}>
                          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontWeight:600,fontSize:14,color:"var(--text)"}}>
                            <input type="checkbox" checked={selfFollowup} onChange={e => { setSelfFollowup(e.target.checked); setFuQrPaid(false); setFuPayMethod("cash"); }}
                              style={{width:16,height:16,cursor:"pointer"}} />
                            Self Follow-up Visit (Rs. {FEES.SELF})
                          </label>
                          <div style={{fontSize:12,color:"var(--text3)",marginTop:6,marginLeft:26}}>Patient is revisiting on their own — Rs. {FEES.SELF} consultation fee applies.</div>
                        </div>
                        {selfFollowup && (
                          <>
                            <div style={{marginTop:14,padding:"14px 18px",border:"1.5px solid #AED6F1",borderRadius:8,background:"var(--primary-lt)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div style={{fontSize:14,fontWeight:600,color:"var(--primary-dk)"}}>Consultation Fee</div>
                              <div style={{fontSize:18,fontWeight:700,color:"var(--primary-dk)"}}>Rs. {FEES.SELF}</div>
                            </div>
                            <label className="f-lbl" style={{marginTop:14}}>Payment Method</label>
                            <div className="pay-grid">
                              <button className={`pay-btn ${fuPayMethod==="cash"?"active":""}`}
                                onClick={() => { if (!fuQrPaid) setFuPayMethod("cash"); }}
                                disabled={fuQrPaid} style={{opacity:fuQrPaid?0.45:1,cursor:fuQrPaid?"not-allowed":"pointer"}}>Cash</button>
                              <button className={`pay-btn ${fuPayMethod==="qr"?"active":""}`}
                                onClick={() => { if (!fuQrPaid) { setFuPayMethod("qr"); setFuShowQR(true); } }}
                                disabled={fuQrPaid} style={{cursor:fuQrPaid?"not-allowed":"pointer"}}>QR Payment</button>
                            </div>
                            {fuQrPaid && <div style={{fontSize:13,fontWeight:600,color:"var(--success)",marginBottom:12}}>✓ QR Payment confirmed — locked</div>}
                            <button className="btn-register" style={{marginTop:8}}
                              onClick={handleSelfFollowUpRegister} disabled={loading || (!fuPayMethod) || (fuPayMethod==="qr" && !fuQrPaid)}>
                              {loading ? "Registering…" : `Register Self Follow-up (Rs. ${FEES.SELF})`}
                            </button>
                          </>
                        )}
                      </>
                    )}

                    {/* Patient found with follow-up */}
                    {fuHasFollowup && (
                      <>
                        <div className="patient-card">
                          <div className="patient-card-name">{fuPatient.name}</div>
                          <div className="patient-card-grid">
                            <div className="patient-card-item">
                              <div className="patient-card-lbl">Patient ID</div>
                              <div className="patient-card-val">{fuPatient.patient_id}</div>
                            </div>
                            <div className="patient-card-item">
                              <div className="patient-card-lbl">Age / Sex</div>
                              <div className="patient-card-val">{fuPatient.age} · {fuPatient.sex}</div>
                            </div>
                            <div className="patient-card-item">
                              <div className="patient-card-lbl">Contact</div>
                              <div className="patient-card-val">{fuPatient.contact}</div>
                            </div>
                            <div className="patient-card-item">
                              <div className="patient-card-lbl">Address</div>
                              <div className="patient-card-val">{fuPatient.address}</div>
                            </div>
                          </div>
                        </div>

                        <div className="followup-banner">
                          <div className="followup-banner-icon">✓</div>
                          <div>
                            <div className="followup-banner-title">Active Follow-up Found</div>
                            <div className="followup-banner-sub">
                              Assigned by Dr. {fuInfo.assigned_by} on {fuInfo.assigned_at}.<br/>
                              Consultation fee is fully waived for this visit.
                            </div>
                          </div>
                        </div>

                        <div className="divider" />
                        {fuAiResult && (
                          <div className="doctor-box">
                            <div className="doctor-box-tag">Assigned Doctor (Original)</div>
                            <div className="doctor-box-name">Dr. {fuAiResult.doctor_name}</div>
                            <div className="doctor-box-spec">{fuAiResult.specialization}</div>
                            <div className="doctor-box-reason">Auto-assigned — same doctor who ordered follow-up</div>
                          </div>
                        )}

                        <div className="fee-box free" style={{marginTop:16}}>
                          <div>
                            <div className="fee-label">Follow-up Visit</div>
                            <div style={{fontSize:12,color:"var(--success)",marginTop:2}}>No charge — one-time follow-up</div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:14,color:"var(--text3)",textDecoration:"line-through"}}>Rs. {FEES.CONSULT}</span>
                            <div className="fee-val">Rs. 0</div>
                          </div>
                        </div>

                        <button
                          className="btn-register success-btn"
                          onClick={handleFollowUpRegister}
                          disabled={loading || !fuHasFollowup}
                        >
                          {loading ? "Registering…" : "Register Follow-up Visit (Free)"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Invoice — shown after any registration */}
            {invoice && (
              <>
                <div className="inv-section-head">
                  <span className="inv-section-lbl">Consultation Invoice</span>
                  <button className="btn-print" onClick={handlePrint}>Print</button>
                </div>
                <div id="consult-invoice-print">
                  <InvoiceCard invoice={invoice} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: Patient List ── */}
        <div className="panel">
          <div className="panel-top">
            <div className="panel-heading">Registered Patients</div>
            <div className="panel-sub">View and search all patients in the system</div>
          </div>
          <div className="scroll">
            <div className="sec-hd">
              <span style={{fontSize:13,color:"var(--text3)"}}>{filtered.length} patient{filtered.length!==1?"s":""} found</span>
              <input className="search-input" placeholder="Search by name, ID, contact…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr>{["Patient ID","Name","Age","Sex","Contact","Address"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.length===0 && <tr><td colSpan={6} className="tbl-empty">No patients found.</td></tr>}
                  {filtered.map(p => (
                    <tr key={p.patient_id}>
                      <td>{p.patient_id}</td>
                      <td style={{fontWeight:600}}>{p.name}</td>
                      <td>{p.age}</td><td>{p.sex}</td>
                      <td>{p.contact}</td><td>{p.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Self Follow-up QR Modal */}
      {fuShowQR && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">{HOSPITAL_NAME}</div>
            <div className="modal-sub">Self Follow-up — Rs. {FEES.SELF}</div>
            <div style={{display:"flex",justifyContent:"center"}}>
              <QRCode value={`hospital:NiO|type:self-followup|amount:${FEES.SELF}`} size={180} />
            </div>
            <div className="modal-amount">Amount: <strong style={{color:"var(--primary-dk)"}}>Rs. {FEES.SELF}</strong></div>
            <div className="modal-btns">
              <button style={{background:"var(--primary-dk)",color:"#fff"}}
                onClick={() => { setFuShowQR(false); setFuQrPaid(true); toast.success("Payment confirmed."); }}>
                Paid
              </button>
              <button style={{background:"var(--danger)",color:"#fff"}}
                onClick={() => { setFuShowQR(false); setFuQrPaid(false); setFuPayMethod(""); toast.info("QR cancelled."); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQR && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">{HOSPITAL_NAME}</div>
            <div className="modal-sub">Scan to pay consultation fee</div>
            <div style={{display:"flex",justifyContent:"center"}}>
              <QRCode value={`hospital:NiO|type:consultation|amount:${FEES.CONSULT}`} size={180} />
            </div>
            <div className="modal-amount">Amount: <strong style={{color:"var(--primary-dk)"}}>Rs. {FEES.CONSULT}</strong></div>
            <div className="modal-btns">
              <button style={{background:"var(--primary-dk)",color:"#fff"}}
                onClick={() => { setShowQR(false); setQrPaid(true); toast.success("Payment confirmed."); }}>
                Paid
              </button>
              <button style={{background:"var(--danger)",color:"#fff"}}
                onClick={() => { setShowQR(false); setQrPaid(false); setField("paymentMethod",""); toast.info("QR cancelled — please select a payment method."); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
