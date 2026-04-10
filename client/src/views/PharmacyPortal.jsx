import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../styles/pharmacy-portal.css";
import QRCode from "react-qr-code";
import apiClient from "../utils/api";
import { fmtDate, fmtBillDate, todayISO } from "../utils/date";
import { currency } from "../utils/format";
import { STORAGE_KEYS, HOSPITAL_NAME, HOSPITAL_ADDR, HOSPITAL_PHONE } from "../constants";
import Topbar from "../components/Topbar";
import PatientSearchInput from "../components/PatientSearchInput";

/* ── helpers ── */
const byRecent    = (l) => [...l].sort((a,b) => new Date(b.created_at)-new Date(a.created_at));
const isValidTest = (t) => { const n = typeof t==="string"?t:t?.test_name; return n&&n.trim()!==""&&n!=="No tests selected"; };

const calculateQty = (dose, duration, type) => {
  // Category-based defaults when dose/duration missing
  const catDefaults = {
    analgesic:15, nsaid:15, antibiotic:10, antihistamine:10, antacid:15,
    antidiabetic:30, antihypertensive:30, expectorant:2, rehydration:5,
    supplement:30, anxiolytic:15, corticosteroid:10, bronchodilator:1,
  };
  const t = (type||"").toLowerCase();
  if (!dose || !duration) {
    for (const [cat, qty] of Object.entries(catDefaults)) {
      if (t.includes(cat)) return qty;
    }
    return 10; // generic fallback instead of 1
  }
  const days   = parseInt(duration);
  const perDay = dose.split("-").map(Number).filter(n=>!isNaN(n)).reduce((a,b)=>a+b, 0) || 2;
  if (!days || days < 1) return 10;
  if (t==="tablet"||t==="capsule"||t==="analgesic"||t==="nsaid"||t==="antibiotic"||t==="antidiabetic"||t==="antihypertensive"||t==="antihistamine"||t==="antacid"||t==="anxiolytic"||t==="corticosteroid"||t==="supplement") return perDay*days;
  if (t==="syrup"||t==="expectorant") return Math.max(1, Math.ceil((perDay*days)/100));
  if (t==="cream") return Math.max(1, Math.ceil((dose.includes("2")?2:1)*days*0.5/10));
  if (t==="bronchodilator") return 1;
  return perDay*days;
};

/* ── CSS (pharmacy-specific only) ── */

/* ── Invoice Card ── */
const InvoiceCard = ({ invoiceData, selectedReport, paymentMethod }) => {
  if (!invoiceData) return null;
  const inv        = invoiceData;
  const subtotal   = inv.items.reduce((s,i) => s+i.subtotal, 0);
  const discPct    = inv.discount || 0;
  const discAmt    = (subtotal*discPct)/100;
  const finalTotal = subtotal-discAmt;
  const pharmacist = localStorage.getItem("fullName") || localStorage.getItem("userEmail") || "Unknown";
  const payDisplay = (inv.payment_method || paymentMethod || "N/A").toUpperCase();

  return (
    <div className="inv-wrap">
      {/* Header */}
      <div className="inv-head">
        <div className="inv-logo-row">
          <div className="inv-logo">🏥</div>
          <div>
            <div className="inv-hospital">NiO's Hospital</div>
            <div className="inv-meta">
              Birtamode-5, Jhapa, Nepal<br />
              +977 023-123456
            </div>
          </div>
        </div>
        <div className="inv-badges">
          <div className="inv-badge">
            <div className="inv-badge-label">Invoice No.</div>
            <div className="inv-badge-val">INV-{String(inv.bill_id).padStart(4,"0")}</div>
          </div>
          <div className="inv-badge">
            <div className="inv-badge-label">Date</div>
            <div className="inv-badge-val" style={{fontSize:14}}>{new Date().toISOString().slice(0,10)}</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="inv-body">
        {/* Patient info */}
        <div className="inv-patient-row">
          <div>
            <div className="inv-patient-lbl">Bill To</div>
            <div className="inv-patient-name">{selectedReport?.structured_data?.["Patient Name"]}</div>
            <div className="inv-patient-sub">{selectedReport?.structured_data?.Address || "—"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="inv-patient-lbl">Patient ID</div>
            <div className="inv-patient-name">PT-{String(selectedReport?.id).padStart(6,"0")}</div>
          </div>
        </div>

        {/* Items table */}
        <div className="tbl-box">
          <table className="inv-tbl">
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Strength</th>
                <th>Manufacturer</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th style={{textAlign:"right"}}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item,i) => (
                <tr key={i}>
                  <td>{item.description || item.medicine_name}</td>
                  <td style={{color:"var(--text3)"}}>{item.strength || "—"}</td>
                  <td style={{color:"var(--text3)"}}>{item.manufacturer || "—"}</td>
                  <td>{item.qty}</td>
                  <td>Rs. {item.price}</td>
                  <td style={{textAlign:"right"}}>Rs. {item.subtotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="inv-total-box">
          <div className="inv-total-row"><span>Subtotal</span><span>Rs. {subtotal}</span></div>
          {discPct > 0 && (
            <div className="inv-total-row" style={{color:"var(--accent)"}}>
              <span>Discount ({discPct}%)</span>
              <span>- Rs. {discAmt.toFixed(2)}</span>
            </div>
          )}
          <div className="inv-total-grand">
            <span>Grand Total</span>
            <span>Rs. {finalTotal.toFixed(2)}</span>
          </div>
          <div className="inv-pay-note">
            Payment Method: <strong>{payDisplay}</strong>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="inv-foot">
        Generated by <strong>Pharmacist ({pharmacist})</strong>
      </div>
    </div>
  );
};

/* ── Prescription Card (identical to DoctorPortal) ── */
const RxCard = ({ p, onLoadToCart }) => {
  const vTests = (p.tests || []).filter(isValidTest);
  return (
    <div className="rx-card">
      <div className="rx-card-top">
        <div className="rx-dx-lbl">Diagnosis</div>
        <div className="rx-dx-val">{p.diagnosis}</div>
      </div>
      <div className="rx-body">
        <button className="btn-load" onClick={() => onLoadToCart(p)}>
          + Load to Basket
        </button>

        {p.medicines?.length > 0 && (
          <>
            <div className="sub-lbl">Medicines Prescribed</div>
            <div className="tbl-box">
              <table className="tbl">
                <thead><tr><th>Name</th><th>Dose</th><th>Timing</th><th>Duration</th></tr></thead>
                <tbody>
                  {p.medicines.map((m,j) => (
                    <tr key={j}><td>{m.name}</td><td>{m.dose}</td><td>{m.timing}</td><td>{m.duration}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {vTests.length > 0 && (
          <>
            <div className="sub-lbl" style={{marginTop:14}}>Laboratory Tests</div>
            <div className="tbl-box">
              <table className="tbl">
                <thead><tr><th>Test Name</th><th>Status</th></tr></thead>
                <tbody>
                  {vTests.map((t,j) => (
                    <tr key={j}>
                      <td>{typeof t==="string"?t:t.test_name}</td>
                      <td><span className="badge b-pending">{t.status||"Pending"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="rx-foot">
          <span>{fmtDate(p.created_at)}</span>
          <span>Dr. <strong>{p.doctor||"Unknown"}</strong></span>
        </div>
      </div>
    </div>
  );
};

/* ── Main Component ── */
export default function PharmacyPortal() {
  const userEmail = localStorage.getItem("userEmail") || "Pharmacist";

  const [reports,        setReports]        = useState([]);
  const [medicines,      setMedicines]      = useState([]);
  const [patientName,    setPatientName]    = useState("");
  const [showSugg,       setShowSugg]       = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [prescriptions,  setPrescriptions]  = useState([]);
  const [bills,          setBills]          = useState([]);

  const [medSearch,    setMedSearch]    = useState("");
  const [showMedSugg,  setShowMedSugg]  = useState(false);
  const [selectedMed,  setSelectedMed]  = useState(null);
  const [qty,          setQty]          = useState(1);
  const [cart,         setCart]         = useState([]);
  const [discount,     setDiscount]     = useState(0);
  const [payMethod,    setPayMethod]    = useState("cash");

  const [openInvoiceId, setOpenInvoiceId] = useState(null);
  const [invoiceData,   setInvoiceData]   = useState(null);
  const [showQR,        setShowQR]        = useState(false);
  const [qrPaid,        setQrPaid]        = useState(false);

  const [sortRx,  setSortRx]  = useState(false);
  const [sortBill,setSortBill]= useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [pr, mr] = await Promise.all([
          apiClient.get("/patients/"),
          apiClient.get("/pharmacy-admin/medicines/"),
        ]);
        setReports(pr.data || []);
        setMedicines(mr.data.medicines || []);
      } catch { /* silent */ }
    })();
  }, []);

  const filteredReports = reports.filter(r => {
    const q = patientName.trim().toLowerCase();
    if (!q) return false;
    const name    = String(r.structured_data?.["Patient Name"] || "").toLowerCase();
    const pid     = String(r.structured_data?.["Patient ID"]   || "").toLowerCase();
    const contact = String(r.structured_data?.["Contact"]      || "").toLowerCase();
    const address = String(r.structured_data?.["Address"]      || "").toLowerCase();
    return name.includes(q) || pid.includes(q) || contact.includes(q) || address.includes(q);
  });
  const filteredMedicines = medicines.filter(m =>
    m.name.toLowerCase().includes(medSearch.toLowerCase())
  );

  const handleSelectPatient = async (r) => {
    setSelectedReport(r);
    setPatientName(r.name || r.structured_data?.["Patient Name"] || "");
    setShowSugg(false);
    try {
      const [pr, br] = await Promise.all([
        apiClient.get(`/prescriptions/${r.id}`),
        apiClient.get(`/pharmacy-admin/billing/patient/${r.id}`),
      ]);
      setPrescriptions((pr.data.prescriptions||[]).filter(p => p.medicines?.length > 0));
      setBills(br.data.bills||[]);
    } catch { toast.error("Failed to load patient data"); }
  };

  const loadPrescriptionToCart = (p) => {
    if (!medicines.length) return toast.error("Medicines not loaded yet");
    const autoCart = [];
    (p.medicines||[]).forEach(m => {
      const found = medicines.find(med => med.name.toLowerCase().includes(m.name.toLowerCase()));
      if (!found) return;
      const autoQty = calculateQty(m.dose, m.duration, found.category?.toLowerCase());
      autoCart.push({ medicine_id:found.id, medicine_name:found.name, qty:autoQty, price:Number(found.price), subtotal:Number(found.price)*autoQty });
    });
    setCart(prev => {
      const next = [...prev];
      autoCart.forEach(item => {
        const ex = next.find(i => i.medicine_id===item.medicine_id);
        if (ex) { ex.qty+=item.qty; ex.subtotal=ex.qty*ex.price; }
        else next.push(item);
      });
      return next;
    });
    toast.success("Prescription added to basket");
  };

  const addToCart = () => {
    if (!selectedMed) return toast.error("Select a medicine first");
    const price = Number(selectedMed.price);
    setCart(prev => [...prev, { medicine_id:selectedMed.id, medicine_name:selectedMed.name, qty, price, subtotal:price*qty }]);
    setQty(1); setMedSearch(""); setSelectedMed(null);
  };

  const handleDiscountChange = (v) => {
    const n = Number(v);
    if (n > 100) { setDiscount(100); toast.warn("Discount cannot exceed 100%"); }
    else setDiscount(n < 0 ? 0 : n);
  };

  const generateBill = async () => {
    if (!selectedReport)          return toast.error("Select a patient");
    if (cart.length===0)          return toast.error("Basket is empty");
    if (!payMethod) return toast.error("Please select a payment method.");
    if (payMethod==="qr"&&!qrPaid) return toast.error("Complete QR payment first — scan and confirm payment.");
    try {
      const payload = { patient_id:selectedReport.id, cart, discount, payment_method:payMethod };
      console.log("Billing payload:", JSON.stringify(payload));
      const res = await apiClient.post("/pharmacy-admin/billing/", payload);
      setCart([]); setDiscount(0);
      const br = await apiClient.get(`/pharmacy-admin/billing/patient/${selectedReport.id}`);
      setBills(br.data.bills||[]);
      openInvoice(res.data.bill_id);
      toast.success("Bill generated");
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.response?.data?.message || "Billing failed";
      toast.error(msg);
      console.error("Billing error:", e?.response?.data);
    }
  };

  const openInvoice = async (billId) => {
    if (!billId) { setOpenInvoiceId(null); setInvoiceData(null); return; }
    try {
      const res = await apiClient.get(`/pharmacy-admin/billing/invoice/${billId}`);
      setInvoiceData(res.data); setOpenInvoiceId(billId);
    } catch { toast.error("Invoice load failed"); }
  };

  const handlePrint = async () => {
    const el = document.getElementById("invoice-print-area");
    if (!el) return toast.error("Invoice not found");
    const res = await fetch("/print-invoice.css");
    const printStyles = await res.text();
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position:"absolute", width:"0", height:"0", border:"none" });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<html><head><title>Invoice</title><style>${printStyles}</style></head><body>${el.innerHTML}</body></html>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
  };

  const totalAmount = cart.reduce((a,b) => a+b.subtotal, 0);
  const discountAmt = (totalAmount*discount)/100;
  const netTotal    = totalAmount-discountAmt;

  const displayedRx   = sortRx   ? byRecent(prescriptions) : prescriptions;
  const displayedBill = sortBill ? [...bills].sort((a,b) => a.bill_id - b.bill_id) : [...bills];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    toast.info("Signed out.");
    setTimeout(() => (window.location.href = "/"), 1200);
  };

  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* TOPBAR */}
      <header className="topbar">
        <div style={{display:"flex",alignItems:"center"}}>
          <span className="topbar-brand">Mero <em>Swasthya</em></span>
          <div className="topbar-sep" />
          <span className="topbar-role">Pharmacy Portal</span>
        </div>
        <div className="topbar-right">
          <span className="topbar-user">Signed in as&nbsp;<strong>{userEmail}</strong></span>
          <button className="btn-out" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <div className="workspace">

        {/* ── LEFT PANEL ── */}
        <div className="panel">
          <div className="panel-top">
            <div className="panel-heading">Patient Lookup</div>
            <div className="panel-sub">Search a patient to view prescriptions and bill history</div>
            <div className="search-wrap">
              <PatientSearchInput
                patients={reports}
                value={patientName}
                onChange={setPatientName}
                onSelect={handleSelectPatient}
              />
            </div>
          </div>

          <div className="scroll">
            {!selectedReport && (
              <div style={{textAlign:"center",padding:"64px 20px",color:"var(--text3)"}}>
                <div style={{fontFamily:"var(--font-serif)",fontSize:18,color:"var(--text2)",marginBottom:8}}>No Patient Selected</div>
                <div style={{fontSize:14}}>Search above to get started</div>
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
                {displayedRx.map((p,i) => (
                  <RxCard key={i} p={p} onLoadToCart={loadPrescriptionToCart} />
                ))}
              </>
            )}

            {/* Bill History */}
            {selectedReport && (
              <>
                <div className="sec-hd" style={{marginTop:28}}>
                  <span className="sec-title">Bill History</span>
                  {bills.length > 0 && (
                    <button className="btn-sort" onClick={() => setSortBill(!sortBill)}>
                      {sortBill ? "Newest First" : "Oldest First"}
                    </button>
                  )}
                </div>
                {bills.length === 0
                  ? <div style={{fontSize:14,color:"var(--text3)"}}>No bills on record.</div>
                  : displayedBill.map((b,i) => (
                    <div key={i} className="bill-card">
                      <div className="bill-card-head">
                        <div>
                          <div style={{fontWeight:600,fontSize:15}}>INV-{String(b.bill_id).padStart(4,"0")} <span style={{fontWeight:400,fontSize:13,color:"var(--text3)"}}>({fmtBillDate(b.date)})</span></div>
                          <div style={{fontSize:13,color:"var(--text3)",marginTop:2}}>Rs. {b.net_total} · {b.status}</div>
                        </div>
                        <div style={{display:"flex",gap:14,alignItems:"center"}}>
                          <button className="btn-ghost"
                            onClick={() => openInvoice(openInvoiceId===b.bill_id ? null : b.bill_id)}>
                            {openInvoiceId===b.bill_id ? "Hide" : "View Invoice"}
                          </button>
                          {openInvoiceId===b.bill_id && (
                            <button className="btn-ghost-print" onClick={handlePrint}>
                              Print
                            </button>
                          )}
                        </div>
                      </div>

                      {openInvoiceId===b.bill_id && (
                        <div id="invoice-print-area">
                          <InvoiceCard
                            invoiceData={invoiceData}
                            selectedReport={selectedReport}
                            paymentMethod={payMethod}
                          />
                        </div>
                      )}
                    </div>
                  ))
                }
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: POS ── */}
        <div className="panel">
          <div className="panel-top">
            <div className="panel-heading">Point of Sale</div>
            <div className="panel-sub">Search and add medicines to the basket</div>
          </div>

          <div className="scroll">
            {/* Medicine Search */}
            <label className="f-lbl">Medicine</label>
            <div style={{position:"relative",marginBottom:12}}>
              <input
                className="ctrl"
                placeholder="Search medicine…"
                value={medSearch}
                onChange={e => { setMedSearch(e.target.value); setShowMedSugg(true); setSelectedMed(null); }}
                onBlur={() => setTimeout(() => setShowMedSugg(false), 160)}
              />
              {showMedSugg && medSearch && filteredMedicines.length > 0 && (
                <div className="med-drop">
                  {filteredMedicines.map((m,i) => (
                    <div key={i} className="med-opt"
                      onMouseDown={() => { setSelectedMed(m); setMedSearch(m.name); setShowMedSugg(false); }}>
                      <span>{m.name}{m.strength?` (${m.strength})`:""} — {m.total_qty===0?"Out of Stock":`Stock: ${m.total_qty}`}</span>
                      <span style={{color:"var(--text3)"}}>Rs. {m.price}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity */}
            <label className="f-lbl">Quantity</label>
            <div className="qty-row">
              <button className="qty-btn qty-btn-minus" onClick={() => qty>1 && setQty(qty-1)}>−</button>
              <span className="qty-val">{qty}</span>
              <button className="qty-btn qty-btn-plus" onClick={() => setQty(qty+1)}>+</button>
            </div>

            <button className="btn-primary" onClick={addToCart} style={{marginBottom:24}}>
              + Add to Basket
            </button>

            <div className="divider" />

            {/* Basket */}
            <label className="f-lbl">Basket</label>
            {cart.length === 0
              ? <div style={{fontSize:14,color:"var(--text3)",padding:"24px 0",textAlign:"center"}}>Basket is empty</div>
              : (
                <div className="tbl-box" style={{marginBottom:16}}>
                  <table className="tbl">
                    <thead><tr><th>Name</th><th>Qty</th><th>Amount</th><th></th></tr></thead>
                    <tbody>
                      {cart.map((it,i) => (
                        <tr key={i}>
                          <td>{it.medicine_name}</td>
                          <td>{it.qty}</td>
                          <td>Rs. {it.subtotal}</td>
                          <td><button className="btn-rm" onClick={() => setCart(cart.filter((_,x)=>x!==i))}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }

            {/* Totals */}
            <div className="total-box">
              <div className="total-row"><span>Subtotal</span><span>Rs. {totalAmount}</span></div>
              <div className="total-row">
                <span>Discount (%)</span>
                <input type="number" min="0" max="100"
                  style={{width:72,padding:"6px 10px",border:"1.5px solid var(--border)",borderRadius:6,textAlign:"center",fontFamily:"var(--font)",fontSize:14,outline:"none"}}
                  value={discount} onChange={e => handleDiscountChange(e.target.value)} />
              </div>
              {discount > 0 && (
                <div className="total-row" style={{color:"var(--accent)"}}>
                  <span>Discount Amount</span><span>- Rs. {discountAmt.toFixed(2)}</span>
                </div>
              )}
              <div className="total-row total-grand"><span>Net Total</span><span>Rs. {netTotal.toFixed(2)}</span></div>
            </div>

            {/* Payment */}
            <label className="f-lbl">Payment Method</label>
            <div className="pay-grid">
              <button className={`pay-btn ${payMethod==="cash"?"active":""}`}
                onClick={() => { if (!qrPaid) setPayMethod("cash"); }}
                disabled={qrPaid}
                style={{opacity:qrPaid?0.45:1,cursor:qrPaid?"not-allowed":"pointer"}}>Cash</button>
              <button className={`pay-btn ${payMethod==="qr"?"active":""}`}
                onClick={() => { if (!qrPaid) { setPayMethod("qr"); setShowQR(true); } }}
                disabled={qrPaid}
                style={{cursor:qrPaid?"not-allowed":"pointer"}}>QR Payment</button>
            </div>
            {qrPaid && <div style={{fontSize:13,fontWeight:600,color:"var(--success)",marginBottom:12}}>✓ QR Payment confirmed — locked</div>}

            <button className="btn-checkout" onClick={generateBill}>
              Checkout & Generate Bill
            </button>
          </div>
        </div>
      </div>

      {/* QR MODAL */}
      {showQR && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">NiO's Hospital Pvt. Ltd.</div>
            <div style={{display:"flex",justifyContent:"center"}}>
              <QRCode value={`hospital:NiO|amount:${netTotal}`} size={180} />
            </div>
            <div className="modal-amount">Amount: <strong>Rs. {netTotal.toFixed(2)}</strong></div>
            <div className="modal-btns">
              <button style={{background:"var(--primary-dk)",color:"#fff"}}
                onClick={() => { setShowQR(false); setQrPaid(true); toast.success("Payment confirmed"); }}>
                Paid
              </button>
              <button style={{background:"var(--danger)",color:"#fff"}}
                onClick={() => { setShowQR(false); setQrPaid(false); setPayMethod(""); toast.info("QR cancelled — select a payment method"); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
