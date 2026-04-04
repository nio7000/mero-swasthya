import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import QRCode from "react-qr-code";
import apiClient from "../utils/api";
import { fmtBillDate, todayISO } from "../utils/date";
import { currency, calcDiscount } from "../utils/format";
import { STORAGE_KEYS, HOSPITAL_NAME, HOSPITAL_ADDR, HOSPITAL_PHONE, MAX_DISCOUNT } from "../constants";
import Topbar from "../components/Topbar";

const CSS = `
.bill-card{border:1.5px solid var(--border);border-radius:8px;padding:16px 18px;margin-bottom:12px;background:var(--surface2);}
.bill-card-head{display:flex;justify-content:space-between;align-items:center;}
.btn-checkout{font-family:var(--font);font-size:15px;font-weight:700;background:var(--primary-dk);color:#fff;border:none;border-radius:6px;padding:14px;cursor:pointer;transition:.15s;width:100%;margin-top:10px;letter-spacing:.3px;}
.btn-checkout:hover{background:var(--primary);}
.btn-ghost-print{font-family:var(--font);font-size:13px;font-weight:600;background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;color:var(--primary);}
.pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;}
.pay-btn{padding:12px;border-radius:6px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text2);font-family:var(--font);font-size:14px;font-weight:600;cursor:pointer;transition:.15s;}
.pay-btn.active{border-color:var(--accent);background:var(--primary-lt);color:var(--primary-dk);}
.total-box{background:var(--surface2);border:1.5px solid var(--border);border-radius:8px;padding:16px 18px;margin-bottom:20px;}
.total-row{display:flex;justify-content:space-between;align-items:center;font-size:14.5px;margin-bottom:8px;}
.total-row:last-child{margin-bottom:0;}
.total-grand{font-size:17px;font-weight:700;color:var(--primary-dk);border-top:2px solid var(--border);padding-top:10px;margin-top:8px;}
.modal-amount{font-size:16px;color:var(--text2);margin:16px 0;}
`;

const InvoiceCard = ({ invoiceData, selectedPatient, paymentMethod }) => {
  if (!invoiceData) return null;
  const inv = invoiceData;
  const items = inv.items || [];
  const subtotal = items.reduce((s,i) => s + (i.subtotal || i.price || 0), 0);
  const discPct = inv.bill?.discount || 0;
  const discAmt = calcDiscount(subtotal, discPct);
  const finalTotal = subtotal - discAmt;
  const staffName = localStorage.getItem(STORAGE_KEYS.FULL_NAME) || localStorage.getItem(STORAGE_KEYS.EMAIL) || "Counter Staff";
  const payDisplay = (inv.bill?.payment_method || paymentMethod || "cash").toUpperCase();
  const billId = inv.bill?.bill_id || inv.bill_id || 0;
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
            <div className="inv-badge-val">INV-{String(billId).padStart(4,"0")}</div>
          </div>
          <div className="inv-badge">
            <div className="inv-badge-label">Date</div>
            <div className="inv-badge-val" style={{fontSize:14}}>{todayISO()}</div>
          </div>
        </div>
      </div>
      <div className="inv-body">
        <div className="inv-patient-row">
          <div>
            <div className="inv-patient-lbl">Bill To</div>
            <div className="inv-patient-name">{selectedPatient?.name || "—"}</div>
            <div className="inv-patient-sub">{selectedPatient?.address || "—"}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="inv-patient-lbl">Patient ID</div>
            <div className="inv-patient-name">PT-{String(selectedPatient?.id||0).padStart(6,"0")}</div>
          </div>
        </div>
        <div className="tbl-box">
          <table className="inv-tbl">
            <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th style={{textAlign:"right"}}>Amount</th></tr></thead>
            <tbody>
              {items.map((item,i) => (
                <tr key={i}>
                  <td>{item.name || item.test_name || "Lab Test"}</td>
                  <td>{item.qty || 1}</td>
                  <td>{currency(item.price)}</td>
                  <td style={{textAlign:"right"}}>{currency(item.subtotal || item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="inv-total-box">
          <div className="inv-total-row"><span>Subtotal</span><span>{currency(subtotal)}</span></div>
          {discPct > 0 && (
            <div className="inv-total-row" style={{color:"var(--accent)"}}>
              <span>Discount ({discPct}%)</span><span>- {currency(discAmt.toFixed(2))}</span>
            </div>
          )}
          <div className="inv-total-grand"><span>Grand Total</span><span>{currency(finalTotal.toFixed(2))}</span></div>
          <div className="inv-pay-note">Payment Method: <strong>{payDisplay}</strong></div>
        </div>
      </div>
      <div className="inv-foot">Generated by <strong>Counter Staff ({staffName})</strong></div>
    </div>
  );
};

export default function CounterPortal() {
  const [patients,        setPatients]        = useState([]);
  const [patientSearch,   setPatientSearch]   = useState("");
  const [showSugg,        setShowSugg]        = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [pendingTests,    setPendingTests]    = useState([]);
  const [billHistory,     setBillHistory]     = useState([]);
  const [cart,            setCart]            = useState([]);
  const [labTests,        setLabTests]        = useState([]);
  const [testSearch,      setTestSearch]      = useState("");
  const [showTestSugg,    setShowTestSugg]    = useState(false);
  const [discount,        setDiscount]        = useState(0);
  const [payMethod,       setPayMethod]       = useState("cash");
  const [showQR,          setShowQR]          = useState(false);
  const [qrPaid,          setQrPaid]          = useState(false);
  const [openInvoiceId,   setOpenInvoiceId]   = useState(null);
  const [invoiceData,     setInvoiceData]     = useState(null);
  const [sortBill,        setSortBill]        = useState(false);

  useEffect(() => {
    apiClient.get("/patients/").then(r => setPatients(r.data)).catch(() => toast.error("Failed to load patients"));
    apiClient.get("/lab/tests").then(r => setLabTests(r.data.tests || [])).catch(() => {});
  }, []);

  const filteredPatients = patients.filter(p => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return false;
    return (p.name||"").toLowerCase().includes(q) ||
           (p.patient_id||"").toLowerCase().includes(q) ||
           (p.contact||"").includes(q) ||
           (p.address||"").toLowerCase().includes(q);
  });

  const handleSelectPatient = async (p) => {
    setSelectedPatient(p); setPatientSearch(p.name); setShowSugg(false);
    setCart([]); setOpenInvoiceId(null); setInvoiceData(null);
    try {
      const [tr, br] = await Promise.all([
        apiClient.get(`/counter/pending-tests/${encodeURIComponent(p.name)}`),
        apiClient.get(`/billing/patient/${p.id}`),
      ]);
      setPendingTests(tr.data.pending_tests || []);
      setBillHistory(br.data.bills || []);
    } catch { toast.error("Failed to load patient details"); }
  };

  const addToCart = (t) => {
    if (cart.some(c => c.id === t.id)) return toast.warn("Already in cart");
    setCart(prev => [...prev, { id:t.id, name:t.test_name, price:t.price, qty:1, subtotal:t.price }]);
  };

  const addLabTestToCart = (t) => {
    const cartId = "lab_" + t.id;
    if (cart.some(c => c.id === cartId)) return toast.warn("Already in cart");
    setCart(prev => [...prev, { id:cartId, labTestId:t.id, name:t.name, price:t.price, qty:1, subtotal:t.price, manual:true }]);
    setTestSearch(""); setShowTestSugg(false);
  };

  const handleDiscountChange = (val) => {
    let v = Number(val);
    if (v > MAX_DISCOUNT) { setDiscount(MAX_DISCOUNT); toast.warn("Discount cannot exceed 100%"); }
    else setDiscount(v < 0 ? 0 : v);
  };

  const totalAmount = cart.reduce((s,i) => s + i.subtotal, 0);
  const discountAmt = calcDiscount(totalAmount, discount);
  const netTotal    = totalAmount - discountAmt;

  const generateBill = async () => {
    if (!selectedPatient)            return toast.error("Select a patient first");
    if (cart.length === 0)           return toast.error("Cart is empty");
    if (!payMethod)                  return toast.error("Please select a payment method.");
    if (payMethod==="qr" && !qrPaid) return toast.error("Complete QR payment first — scan and confirm payment.");
    try {
      const pendingItems = cart.filter(i => !i.manual);
      const manualItems  = cart.filter(i => i.manual);

      const payload = {
        patient_id:     selectedPatient.id,
        test_ids:       pendingItems.map(i => i.id),
        manual_tests:   manualItems.map(i => ({ lab_test_id: i.labTestId, name: i.name, price: i.price })),
        discount,
        payment_method: payMethod,
      };

      const res = await apiClient.post("/counter/pay-tests/", payload);
      toast.success("Bill generated successfully");
      setPendingTests(prev => prev.filter(t => !pendingItems.some(c => c.id === t.id)));
      setCart([]); setDiscount(0);
      const br = await apiClient.get(`/billing/patient/${selectedPatient.id}`);
      setBillHistory(br.data.bills || []);
      openInvoice(res.data.bill_id);
    } catch { toast.error("Billing error — please try again"); }
  };

  const openInvoice = async (billId) => {
    if (!billId || openInvoiceId === billId) { setOpenInvoiceId(null); setInvoiceData(null); return; }
    try {
      const res = await apiClient.get(`/billing/invoice/${billId}`);
      setInvoiceData(res.data); setOpenInvoiceId(billId);
    } catch { toast.error("Failed to load invoice"); }
  };

  const handlePrint = () => {
    const el = document.getElementById("counter-invoice-print");
    if (!el) return toast.error("Invoice not found");
    const printCSS = `
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Serif:wght@400;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      :root{--primary:#1B4F72;--primary-dk:#154360;--accent:#2E86C1;--border:#CDD5DF;--text:#1A202C;--text2:#374151;--text3:#6B7280;--font:'IBM Plex Sans',sans-serif;--font-serif:'IBM Plex Serif',serif;}
      body{font-family:var(--font);font-size:14px;color:var(--text);background:#fff;padding:24px;}
      .inv-wrap{border-radius:10px;overflow:hidden;border:1.5px solid var(--border);}
      .inv-head{background:var(--primary-dk);padding:22px 28px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .inv-logo-row{display:flex;align-items:center;gap:14px;}
      .inv-logo{width:48px;height:48px;background:rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;}
      .inv-hospital{font-family:var(--font-serif);font-size:19px;color:#fff;margin-bottom:3px;}
      .inv-meta{font-size:12px;color:#AED6F1;line-height:1.7;}
      .inv-badges{display:flex;flex-direction:column;gap:8px;}
      .inv-badge{background:rgba(255,255,255,.15);padding:9px 14px;border-radius:6px;text-align:right;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .inv-badge-label{font-size:10px;color:#AED6F1;text-transform:uppercase;letter-spacing:.7px;margin-bottom:2px;}
      .inv-badge-val{font-size:16px;font-weight:700;color:#fff;}
      .inv-body{padding:24px 28px;}
      .inv-patient-row{display:flex;justify-content:space-between;margin-bottom:20px;}
      .inv-patient-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:4px;}
      .inv-patient-name{font-size:16px;font-weight:600;}
      .inv-patient-sub{font-size:13px;color:var(--text3);}
      .tbl-box{border:1.5px solid var(--border);border-radius:6px;overflow:hidden;}
      .inv-tbl{width:100%;border-collapse:collapse;font-size:14px;}
      .inv-tbl th{padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);border-bottom:1.5px solid var(--border);background:#E8EEF5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .inv-tbl td{padding:10px 12px;border-bottom:1px solid var(--border);}
      .inv-tbl tr:last-child td{border-bottom:none;}
      .inv-tbl tbody tr:nth-child(even) td{background:#F8FAFE;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .inv-total-box{max-width:280px;margin-left:auto;margin-top:18px;padding:16px 18px;border:1.5px solid var(--border);border-radius:8px;}
      .inv-total-row{display:flex;justify-content:space-between;font-size:14px;margin-bottom:7px;}
      .inv-total-grand{font-size:16px;font-weight:700;color:var(--primary-dk);border-top:1.5px solid var(--border);padding-top:10px;margin-top:8px;display:flex;justify-content:space-between;}
      .inv-pay-note{font-size:12px;color:var(--text3);border-top:1px dashed var(--border);margin-top:10px;padding-top:10px;}
      .inv-foot{padding:14px 28px;border-top:1.5px solid var(--border);font-size:13px;color:var(--text3);}
    `;
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position:"absolute", width:"0", height:"0", border:"none" });
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<html><head><title>Invoice</title><style>${printCSS}</style></head><body>${el.innerHTML}</body></html>`);
    doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 400);
  };

  const displayedBill = sortBill ? [...billHistory].sort((a,b) => b.bill_id - a.bill_id) : [...billHistory];

  return (
    <>
      <style>{CSS}</style>
      <ToastContainer position="top-right" autoClose={3000} />
      <Topbar role="Counter Portal" />
      <div className="workspace">
        <div className="panel">
          <div className="panel-top">
            <div className="panel-heading">Patient Lookup</div>
            <div className="panel-sub">Search a patient to view pending tests and bill history</div>
            <div className="search-wrap">
              <input className="search-input" placeholder="Search by patient name, ID or contact…"
                value={patientSearch}
                onChange={e => { setPatientSearch(e.target.value); setShowSugg(true); }}
                onBlur={() => setTimeout(() => setShowSugg(false), 160)} />
              {showSugg && patientSearch && filteredPatients.length > 0 && (
                <div className="drop">
                  {filteredPatients.map(p => (
                    <div key={p.id} className="drop-item" onMouseDown={() => handleSelectPatient(p)}>
                      <span style={{fontWeight:600}}>{p.name}</span>
                      <span style={{color:"var(--text3)",fontSize:13,marginLeft:10}}>
                        {p.patient_id}{p.age ? ` · ${p.age}y` : ""}{p.sex ? ` · ${p.sex}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="scroll">
            {!selectedPatient ? (
              <div style={{textAlign:"center",padding:"64px 20px",color:"var(--text3)"}}>
                <div style={{fontFamily:"var(--font-serif)",fontSize:18,color:"var(--text2)",marginBottom:8}}>No Patient Selected</div>
                <div style={{fontSize:14}}>Search above to get started</div>
              </div>
            ) : (
              <>
                <div className="sec-hd">
                  <span className="sec-title">Pending Lab Tests</span>
                  <span style={{fontSize:13,color:"var(--text3)"}}>{pendingTests.length} unpaid</span>
                </div>
                {pendingTests.length === 0
                  ? <div style={{fontSize:14,color:"var(--text3)",padding:"12px 0"}}>No pending tests for this patient.</div>
                  : pendingTests.map(t => (
                    <div key={t.id} className="rx-card">
                      <div className="rx-card-top">
                        <div>
                          <div className="rx-dx-lbl">Lab Test</div>
                          <div className="rx-dx-val">{t.test_name}</div>
                          <div style={{fontSize:13,color:"var(--text3)",marginTop:4}}>{currency(t.price)}</div>
                        </div>
                        <button className="btn-load" disabled={cart.some(c => c.id === t.id)} onClick={() => addToCart(t)}>
                          {cart.some(c => c.id === t.id) ? "✓ Added" : "+ Add to Cart"}
                        </button>
                      </div>
                    </div>
                  ))
                }
                <div className="sec-hd" style={{marginTop:28}}>
                  <span className="sec-title">Bill History</span>
                  {billHistory.length > 0 && (
                    <button className="btn-sort" onClick={() => setSortBill(!sortBill)}>
                      {sortBill ? "Default Order" : "Most Recent First"}
                    </button>
                  )}
                </div>
                {billHistory.length === 0
                  ? <div style={{fontSize:14,color:"var(--text3)"}}>No bills on record.</div>
                  : displayedBill.map((b,i) => (
                    <div key={b.bill_id} className="bill-card">
                      <div className="bill-card-head">
                        <div>
                          <div style={{fontWeight:600,fontSize:15}}>INV-{String(b.bill_id).padStart(4,"0")} <span style={{fontWeight:400,fontSize:13,color:"var(--text3)"}}>({fmtBillDate(b.date)})</span></div>
                          <div style={{fontSize:13,color:"var(--text3)",marginTop:2}}>{currency(b.net_total)} · {b.status}</div>
                        </div>
                        <div style={{display:"flex",gap:14,alignItems:"center"}}>
                          <button className="btn-ghost" onClick={() => openInvoice(openInvoiceId===b.bill_id ? null : b.bill_id)}>
                            {openInvoiceId===b.bill_id ? "Hide" : "View Invoice"}
                          </button>
                          {openInvoiceId===b.bill_id && <button className="btn-ghost-print" onClick={handlePrint}>Print</button>}
                        </div>
                      </div>
                      {openInvoiceId===b.bill_id && (
                        <div id="counter-invoice-print">
                          <InvoiceCard invoiceData={invoiceData} selectedPatient={selectedPatient} paymentMethod={payMethod} />
                        </div>
                      )}
                    </div>
                  ))
                }
              </>
            )}
          </div>
        </div>
        <div className="panel">
          <div className="panel-top">
            <div className="panel-heading">Point of Sale</div>
            <div className="panel-sub">Add lab tests to cart and generate payment invoice</div>
          </div>
          <div className="scroll">
            <label className="f-lbl">Add Lab Test</label>
            <div style={{position:"relative",marginBottom:16}}>
              <input className="search-input"
                placeholder="Search lab test by name…"
                value={testSearch}
                onChange={e => { setTestSearch(e.target.value); setShowTestSugg(true); }}
                onBlur={() => setTimeout(() => setShowTestSugg(false), 160)}
              />
              {showTestSugg && testSearch && labTests.filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase())).length > 0 && (
                <div className="drop">
                  {labTests.filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase())).map((t,i) => (
                    <div key={i} className="drop-item" onMouseDown={() => addLabTestToCart(t)}>
                      <span style={{fontWeight:600}}>{t.name}</span>
                      <span style={{color:"var(--text3)",fontSize:13,marginLeft:10}}>{currency(t.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="f-lbl">Cart</label>
            {cart.length === 0
              ? <div style={{fontSize:14,color:"var(--text3)",padding:"24px 0",textAlign:"center"}}>Cart is empty — add tests from the left panel</div>
              : (
                <div className="tbl-box" style={{marginBottom:16}}>
                  <table className="tbl">
                    <thead><tr><th>Test Name</th><th>Qty</th><th>Amount</th><th></th></tr></thead>
                    <tbody>
                      {cart.map((it,i) => (
                        <tr key={i}>
                          <td>{it.name}</td>
                          <td>{it.qty}</td>
                          <td>{currency(it.subtotal)}</td>
                          <td><button className="btn-rm" onClick={() => setCart(cart.filter((_,x)=>x!==i))}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
            <div className="divider"/>
            <div className="total-box">
              <div className="total-row"><span>Subtotal</span><span>{currency(totalAmount)}</span></div>
              <div className="total-row">
                <span>Discount (%)</span>
                <input type="number" min="0" max="100"
                  style={{width:72,padding:"6px 10px",border:"1.5px solid var(--border)",borderRadius:6,textAlign:"center",fontFamily:"var(--font)",fontSize:14,outline:"none"}}
                  value={discount} onChange={e => handleDiscountChange(e.target.value)} />
              </div>
              {discount > 0 && (
                <div className="total-row" style={{color:"var(--accent)"}}>
                  <span>Discount Amount</span><span>- {currency(discountAmt.toFixed(2))}</span>
                </div>
              )}
              <div className="total-row total-grand"><span>Net Total</span><span>{currency(netTotal.toFixed(2))}</span></div>
            </div>
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
            <button className="btn-checkout" onClick={generateBill}>Checkout & Generate Bill</button>
          </div>
        </div>
      </div>
      {showQR && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">{HOSPITAL_NAME} Pvt. Ltd.</div>
            <div style={{display:"flex",justifyContent:"center"}}>
              <QRCode value={`hospital:NiO|amount:${netTotal}`} size={180} />
            </div>
            <div className="modal-amount">Amount: <strong>{currency(netTotal.toFixed(2))}</strong></div>
            <div className="modal-btns">
              <button style={{background:"var(--primary-dk)",color:"#fff"}} onClick={() => { setShowQR(false); setQrPaid(true); toast.success("Payment confirmed"); }}>Paid</button>
              <button style={{background:"var(--danger)",color:"#fff"}} onClick={() => { setShowQR(false); setQrPaid(false); setPayMethod(""); toast.info("QR payment cancelled — select payment method"); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
