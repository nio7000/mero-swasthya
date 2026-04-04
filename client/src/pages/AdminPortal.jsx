import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import apiClient, { authHeader } from "../utils/api";
import { fmtDate } from "../utils/date";
import { currency, fmtNumber } from "../utils/format";
import { STORAGE_KEYS, ROLES as ROLE_VALUES } from "../constants";
import Topbar from "../components/Topbar";

/* ── helpers ── */
const ROLE_LIST = ["doctor","pharmacy_admin","pharmacy","technician","receptionist","counter","admin"];

const SPECIALIZATIONS = [
  "General Physician","Dermatologist","Gynecologist","Cardiologist",
  "Orthopedist","Ophthalmologist","Dentist","Pediatrician",
  "Neurologist","Gastroenterologist","ENT Specialist","Psychiatrist",
  "Urologist","Pulmonologist",
];
const ROLES = ROLE_LIST;

const roleBadgeColor = (role) => ({
  doctor:         { bg:"#D6EAF8", color:"#154360" },
  admin:          { bg:"#FADBD8", color:"#C0392B" },
  pharmacy:       { bg:"#D5F5E3", color:"#1E8449" },
  pharmacy_admin: { bg:"#D5F5E3", color:"#1E8449" },
  technician:     { bg:"#FEF9E7", color:"#B7770D" },
  receptionist:   { bg:"#EAF2FB", color:"#2E86C1" },
  counter:        { bg:"#F4ECF7", color:"#7D3C98" },
}[role] || { bg:"#F4F6F9", color:"#374151" });

/* ── Shared summary styles for print & download ── */
const SUMMARY_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Serif:wght@400;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --primary:#1B4F72;--primary-dk:#154360;--primary-lt:#D6EAF8;
    --accent:#2E86C1;--border:#CDD5DF;
    --text:#1A202C;--text2:#374151;--text3:#6B7280;
    --surface:#fff;--surface2:#F4F6F9;
    --font:'IBM Plex Sans',sans-serif;--font-serif:'IBM Plex Serif',serif;
  }
  body{font-family:var(--font);font-size:13.5px;color:var(--text);background:#fff;padding:32px;max-width:900px;margin:0 auto;}

  /* HEADER */
  .doc-header{background:var(--primary-dk);border-radius:10px;padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .doc-logo-row{display:flex;align-items:center;gap:14px;}
  .doc-logo{width:46px;height:46px;background:rgba(255,255,255,.18);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:22px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .doc-hospital{font-family:var(--font-serif);font-size:19px;color:#fff;margin-bottom:3px;}
  .doc-hospital-meta{font-size:12px;color:#AED6F1;line-height:1.7;}
  .doc-badges{display:flex;flex-direction:column;gap:7px;align-items:flex-end;}
  .doc-badge{background:rgba(255,255,255,.15);padding:7px 13px;border-radius:5px;text-align:right;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .doc-badge-lbl{font-size:9.5px;color:#AED6F1;text-transform:uppercase;letter-spacing:.7px;margin-bottom:2px;}
  .doc-badge-val{font-size:14px;font-weight:700;color:#fff;}

  /* PATIENT INFO */
  .patient-block{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid var(--border);}
  .patient-name{font-family:var(--font-serif);font-size:22px;color:var(--primary-dk);margin-bottom:6px;}
  .patient-meta{display:flex;gap:20px;flex-wrap:wrap;font-size:13.5px;color:var(--text2);}
  .patient-meta strong{color:var(--text);}
  .patient-right{text-align:right;}
  .pid-chip{font-size:12px;font-weight:700;color:var(--accent);background:var(--primary-lt);padding:4px 13px;border-radius:4px;border:1px solid #AED6F1;display:inline-block;margin-bottom:8px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .total-spent{font-size:13px;color:var(--text3);}
  .total-spent strong{font-size:18px;font-weight:700;color:var(--primary-dk);display:block;}

  /* SECTION */
  .section{margin-bottom:28px;}
  .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--primary);margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid var(--border);display:flex;justify-content:space-between;align-items:center;}
  .section-count{font-size:11px;font-weight:600;color:var(--text3);background:var(--surface2);padding:2px 9px;border-radius:10px;border:1px solid var(--border);}

  /* RX CARD */
  .rx-card{border:1.5px solid var(--border);border-radius:8px;margin-bottom:14px;overflow:hidden;}
  .rx-head{background:var(--surface2);padding:11px 16px;border-bottom:1px solid var(--border);-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .rx-dx-lbl{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);margin-bottom:3px;}
  .rx-dx{font-size:14.5px;font-weight:600;color:var(--text);}
  .rx-body{padding:14px 16px;}
  .sub-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:8px;}

  /* TABLE */
  .data-table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:12px;}
  .data-table th{padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);border-bottom:1.5px solid var(--border);background:#E8EEF5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .data-table td{padding:9px 12px;border-bottom:1px solid var(--border);color:var(--text);}
  .data-table tr:last-child td{border-bottom:none;}
  .data-table tbody tr:nth-child(even) td{background:#F8FAFE;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .tbl-wrap{border:1px solid var(--border);border-radius:6px;overflow:hidden;}

  .rx-foot{display:flex;justify-content:space-between;font-size:11.5px;color:var(--text3);margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);}

  /* INVOICE CARD — matches CounterPortal/PharmacyPortal exactly */
  .inv-wrap{background:#fff;border-radius:10px;overflow:hidden;border:1.5px solid var(--border);margin-bottom:20px;}
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
  .inv-patient-lbl{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:4px;}
  .inv-patient-name{font-size:16px;font-weight:600;color:var(--text);}
  .inv-patient-sub{font-size:13px;color:var(--text3);}
  .inv-tbl{width:100%;border-collapse:collapse;font-size:14px;}
  .inv-tbl th{padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);border-bottom:1.5px solid var(--border);background:#E8EEF5;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .inv-tbl td{padding:10px 12px;border-bottom:1px solid var(--border);color:var(--text);}
  .inv-tbl tr:last-child td{border-bottom:none;}
  .inv-tbl tbody tr:nth-child(even) td{background:#F8FAFE;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .inv-total-box{max-width:280px;margin-left:auto;margin-top:18px;padding:16px 18px;border:1.5px solid var(--border);border-radius:8px;}
  .inv-total-row{display:flex;justify-content:space-between;font-size:14px;margin-bottom:7px;}
  .inv-total-grand{font-size:16px;font-weight:700;color:var(--primary-dk);border-top:1.5px solid var(--border);padding-top:10px;margin-top:8px;display:flex;justify-content:space-between;}
  .inv-pay-note{font-size:12px;color:var(--text3);border-top:1px dashed var(--border);margin-top:10px;padding-top:10px;}
  .inv-foot{padding:14px 28px;border-top:1.5px solid var(--border);font-size:13px;color:var(--text3);}

  /* FOOTER */
  .doc-footer{margin-top:36px;padding-top:16px;border-top:1.5px solid var(--border);display:flex;justify-content:space-between;font-size:12px;color:var(--text3);}
  .doc-footer strong{color:var(--text2);}

  .empty{font-size:13px;color:var(--text3);padding:14px 0;font-style:italic;}

  @media print{
    body{padding:16px;}
    .doc-header{border-radius:6px;}
  }
`;

/* ── Build summary HTML ── */
const buildSummaryHTML = (patient, summary) => {
  const totalSpent = summary.bills.reduce((s, b) => s + (b.net_total || 0), 0);
  const aiReports  = summary.aiReports || [];

  const reportCards = aiReports.length === 0
    ? `<div class="empty">No lab reports uploaded.</div>`
    : aiReports.map(r => {
        const analysis = (r.ocr_report && r.ocr_report.medical_analysis) ? r.ocr_report.medical_analysis : {};
        const rows = Object.entries(analysis).map(([key, val]) => {
          const color = val.status === "High" ? "#C0392B" : val.status === "Low" ? "#B7770D" : "#1E8449";
          return `<tr><td style="font-weight:600">${key}</td><td>${val.value||"—"}</td><td style="color:#6B7280">${val.unit||"—"}</td><td style="color:#6B7280">${val.range||"—"}</td><td style="font-weight:700;color:${color}">${val.status||"—"}</td></tr>`;
        }).join("");
        return `
          <div class="rx-card">
            <div class="rx-head">
              <div class="rx-dx-lbl">Test</div>
              <div class="rx-dx">${r.test_name || "Lab Report"}</div>
            </div>
            <div class="rx-body">
              ${rows ? `<div class="tbl-wrap"><table class="data-table"><thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Normal Range</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div style="color:#6B7280;font-size:13px;font-style:italic">No structured values extracted.</div>`}
              <div class="rx-foot"><span>${r.created_at || "—"}</span><span style="color:${r.status==="Completed"?"#1E8449":"#B7770D"};font-weight:700">${r.status||"Pending"}</span></div>
            </div>
          </div>`;
      }).join("");
  const now        = new Date().toLocaleString("en-US", { year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" });

  const rxCards = summary.prescriptions.length === 0
    ? `<div class="empty">No prescriptions on record.</div>`
    : summary.prescriptions.map(p => {
        const meds = (p.medicines||[]).length > 0
          ? `<div class="sub-label">Medicines Prescribed</div>
             <div class="tbl-wrap">
               <table class="data-table">
                 <thead><tr><th>Name</th><th>Dose</th><th>Timing</th><th>Duration</th></tr></thead>
                 <tbody>${(p.medicines||[]).map(m =>
                   `<tr><td>${m.name||"—"}</td><td>${m.dose||"—"}</td><td>${m.timing||"—"}</td><td>${m.duration||"—"}</td></tr>`
                 ).join("")}</tbody>
               </table>
             </div>` : "";
        const tests = (p.tests||[]).filter(t => t.test_name && t.test_name.trim() !== "" && t.test_name !== "No tests selected").length > 0
          ? `<div class="sub-label" style="margin-top:14px">Laboratory Tests</div>
             <div class="tbl-wrap">
               <table class="data-table">
                 <thead><tr><th>Test Name</th><th>Status</th></tr></thead>
                 <tbody>${(p.tests||[]).filter(t => t.test_name && t.test_name.trim() !== "" && t.test_name !== "No tests selected").map(t =>
                   `<tr><td>${t.test_name}</td><td><span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:700;background:${t.status==="Completed"?"#D5F5E3":"#FEF9E7"};color:${t.status==="Completed"?"#1E8449":"#B7770D"}">${t.status||"Pending"}</span></td></tr>`
                 ).join("")}</tbody>
               </table>
             </div>` : "";
        return `
          <div class="rx-card">
            <div class="rx-head">
              <div class="rx-dx-lbl">Diagnosis</div>
              <div class="rx-dx">${p.diagnosis || "—"}</div>
            </div>
            <div class="rx-body">
              ${meds}
              ${tests}
              <div class="rx-foot">
                <span>${fmtDate(p.created_at)}</span>
                <span>Dr. ${p.doctor || "Unknown"}</span>
              </div>
            </div>
          </div>`;
      }).join("");

  const billCards = summary.bills.length === 0
    ? '<div class="empty">No billing records on file.</div>'
    : summary.bills.map((b, idx) => {
        const inv        = summary.invoices ? summary.invoices[idx] : null;
        const items      = (inv && inv.items) ? inv.items : (b.items || []);
        const subtotal   = items.reduce((s,it) => s + (it.subtotal || (it.qty||1)*(it.price||0)), 0);
        const discPct    = (inv && inv.bill && inv.bill.discount) ? inv.bill.discount : (b.discount || 0);
        const discAmt    = (subtotal * discPct) / 100;
        const finalTotal = subtotal - discAmt;
        const payDisplay = ((inv && inv.bill && inv.bill.payment_method) || b.payment_method || "cash").toUpperCase();
        const invNum     = "INV-" + String(b.bill_id).padStart(4,"0");
        const patName    = patient.name || "—";
        const patAddr    = patient.address || "—";
        const patPid     = patient.patient_id || ("PT-" + String(patient.id||0).padStart(6,"0"));
        const today      = new Date().toISOString().slice(0,10);

        let itemRows = "";
        if (items.length === 0) {
          itemRows = '<tr><td colspan="4" style="color:#6B7280;font-style:italic;padding:10px 12px">No item details</td></tr>';
        } else {
          itemRows = items.map((it, j) => {
            const n  = it.name || it.medicine_name || (it.medicine_id === 0 ? "Consultation / Lab Test" : "Medicine");
            const q  = it.qty || 1;
            const p  = Number(it.price || 0).toLocaleString();
            const a  = Number(it.subtotal || (it.qty||1)*(it.price||0)).toLocaleString();
            const bg = j % 2 === 1 ? ' style="background:#F8FAFE"' : '';
            return '<tr' + bg + '><td style="padding:10px 12px;border-bottom:1px solid #CDD5DF">' + n + '</td><td style="padding:10px 12px;border-bottom:1px solid #CDD5DF">' + q + '</td><td style="padding:10px 12px;border-bottom:1px solid #CDD5DF">Rs. ' + p + '</td><td style="padding:10px 12px;border-bottom:1px solid #CDD5DF;text-align:right">Rs. ' + a + '</td></tr>';
          }).join("");
        }

        const discRow = discPct > 0
          ? '<div class="inv-total-row" style="color:#2E86C1"><span>Discount (' + discPct + '%)</span><span>- Rs. ' + discAmt.toFixed(2) + '</span></div>'
          : "";

        return (
          '<div class="inv-wrap">' +
            '<div class="inv-head">' +
              '<div class="inv-logo-row">' +
                '<div class="inv-logo">🏥</div>' +
                '<div><div class="inv-hospital">NiO&#39;s Hospital</div><div class="inv-meta">Birtamode-5, Jhapa, Nepal<br/>+977 023-123456</div></div>' +
              '</div>' +
              '<div class="inv-badges">' +
                '<div class="inv-badge"><div class="inv-badge-label">Invoice No.</div><div class="inv-badge-val">' + invNum + '</div></div>' +
                '<div class="inv-badge"><div class="inv-badge-label">Date</div><div class="inv-badge-val" style="font-size:14px">' + today + '</div></div>' +
              '</div>' +
            '</div>' +
            '<div class="inv-body">' +
              '<div class="inv-patient-row">' +
                '<div><div class="inv-patient-lbl">Bill To</div><div class="inv-patient-name">' + patName + '</div><div class="inv-patient-sub">' + patAddr + '</div></div>' +
                '<div style="text-align:right"><div class="inv-patient-lbl">Patient ID</div><div class="inv-patient-name">' + patPid + '</div></div>' +
              '</div>' +
              '<div class="tbl-wrap"><table class="inv-tbl">' +
                '<thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th style="text-align:right">Amount</th></tr></thead>' +
                '<tbody>' + itemRows + '</tbody>' +
              '</table></div>' +
              '<div class="inv-total-box">' +
                '<div class="inv-total-row"><span>Subtotal</span><span>Rs. ' + subtotal.toLocaleString() + '</span></div>' +
                discRow +
                '<div class="inv-total-grand"><span>Grand Total</span><span>Rs. ' + finalTotal.toFixed(2) + '</span></div>' +
                '<div class="inv-pay-note">Payment Method: <strong>' + payDisplay + '</strong></div>' +
              '</div>' +
            '</div>' +
            '<div class="inv-foot">Generated by <strong>Admin &#8212; NiO&#39;s Hospital</strong></div>' +
          '</div>'
        );
      }).join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <title>Patient Summary — ${patient.name}</title>
      <style>${SUMMARY_CSS}</style>
    </head>
    <body>
      <!-- HEADER -->
      <div class="doc-header">
        <div class="doc-logo-row">
          <div class="doc-logo">🏥</div>
          <div>
            <div class="doc-hospital">NiO's Hospital</div>
            <div class="doc-hospital-meta">Birtamode-5, Jhapa, Nepal<br/>+977 023-123456</div>
          </div>
        </div>
        <div class="doc-badges">
          <div class="doc-badge">
            <div class="doc-badge-lbl">Document Type</div>
            <div class="doc-badge-val">Patient Summary</div>
          </div>
          <div class="doc-badge">
            <div class="doc-badge-lbl">Generated</div>
            <div class="doc-badge-val" style="font-size:12px">${now}</div>
          </div>
        </div>
      </div>

      <!-- PATIENT INFO -->
      <div class="patient-block">
        <div>
          <div class="patient-name">${patient.name}</div>
          <div class="patient-meta">
            <span><strong>Age:</strong> ${patient.age || "—"}</span>
            <span><strong>Sex:</strong> ${patient.sex || "—"}</span>
            <span><strong>Contact:</strong> ${patient.contact || "—"}</span>
            <span><strong>Address:</strong> ${patient.address || "—"}</span>
          </div>
        </div>
        <div class="patient-right">
          <div class="pid-chip">${patient.patient_id}</div>
          <div class="total-spent">
            Total Billed
            <strong>Rs. ${totalSpent.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <!-- PRESCRIPTIONS -->
      <div class="section">
        <div class="section-title">
          Prescriptions
          <span class="section-count">${summary.prescriptions.length}</span>
        </div>
        ${rxCards}
      </div>

      <!-- LAB REPORTS -->
      <div class="section">
        <div class="section-title">
          Lab Reports
          <span class="section-count">${aiReports.length}</span>
        </div>
        ${reportCards}
      </div>

      <!-- BILLING -->
      <div class="section">
        <div class="section-title">
          Billing History
          <span class="section-count">${summary.bills.length}</span>
        </div>
        ${billCards}
      </div>

      <!-- FOOTER -->
      <div class="doc-footer">
        <span>Generated by <strong>${localStorage.getItem("userEmail") || "Admin"}</strong> — NiO's Hospital Admin</span>
        <span><strong>MeroSwasthya</strong> Health System</span>
      </div>
    </body>
    </html>`;
};

/* ── CSS ── */
const CSS = `
.tabs{display:flex;border-bottom:2px solid var(--border);padding:0 36px;background:var(--surface);}
.tab{font-family:var(--font);font-size:14px;font-weight:600;color:var(--text3);background:none;border:none;padding:14px 22px;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;transition:.15s;}
.tab:hover{color:var(--primary);}
.tab.active{color:var(--primary-dk);border-bottom-color:var(--primary-dk);}

.main-area{height:calc(100vh - 116px);overflow-y:auto;padding:32px 36px;}
.main-area::-webkit-scrollbar{width:5px;}
.main-area::-webkit-scrollbar-thumb{background:var(--border-dk);border-radius:3px;}

.workspace{display:grid;grid-template-columns:420px 1fr;gap:28px;}
.panel{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;overflow:hidden;}
.panel-top{padding:22px 28px 18px;border-bottom:2px solid var(--border);}
.panel-heading{font-family:var(--font-serif);font-size:18px;font-weight:600;color:var(--primary-dk);margin-bottom:3px;}
.panel-sub{font-size:13px;color:var(--text3);}
.panel-body{padding:24px 28px;}

.f-lbl{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text2);margin-bottom:6px;margin-top:16px;}
.f-lbl:first-child{margin-top:0;}
.spec-box{margin-top:14px;padding:12px 14px;background:var(--primary-lt);border:1px solid #AED6F1;border-radius:6px;}
.spec-box-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--accent);margin-bottom:8px;}
.btn-create{width:100%;padding:13px;background:var(--primary-dk);color:#fff;border:none;border-radius:6px;font-family:var(--font);font-size:15px;font-weight:700;cursor:pointer;letter-spacing:.3px;transition:.15s;box-shadow:0 3px 10px rgba(21,67,96,.25);}
.btn-create:hover{background:var(--primary);}
.btn-create:disabled{background:var(--border-dk);cursor:not-allowed;box-shadow:none;}

.sec-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.tbl-wrap{overflow-x:auto;}
.tbl{width:100%;border-collapse:collapse;font-size:14px;}
.tbl thead tr{background:#E8EEF5;}
.tbl th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--text2);border-bottom:1.5px solid var(--border);}
.tbl td{padding:11px 14px;color:var(--text);border-bottom:1px solid var(--border);vertical-align:middle;}
.tbl tr:last-child td{border-bottom:none;}
.tbl tbody tr:nth-child(even) td{background:#F8FAFE;}
.tbl tbody tr:hover td{background:var(--primary-lt);}
.search-input{padding:10px 14px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font);font-size:14px;color:var(--text);background:var(--surface2);outline:none;width:300px;transition:.15s;}
.search-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(46,134,193,.12);background:#fff;}
.search-input::placeholder{color:var(--text3);}
.btn-view{background:var(--primary-lt);color:var(--primary-dk);border:1px solid #AED6F1;border-radius:5px;padding:6px 12px;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:.15s;margin-right:6px;}
.btn-view:hover{background:#AED6F1;}
.spec-edit{display:flex;gap:8px;align-items:center;}
.spec-select{padding:6px 10px;border:1.5px solid var(--border);border-radius:5px;font-family:var(--font);font-size:13px;color:var(--text);background:var(--surface2);outline:none;appearance:none;cursor:pointer;}
.btn-save-spec{padding:6px 12px;background:var(--primary-lt);color:var(--primary-dk);border:1px solid #AED6F1;border-radius:5px;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:.15s;}
.btn-save-spec:hover{background:#AED6F1;}
.tbl-empty{text-align:center;padding:48px;color:var(--text3);font-size:14px;}
.deleted-row td{opacity:.45;text-decoration:line-through;}

/* ANALYTICS */
.stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:28px;}
.stat-grid-6{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;}
.stat-card{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:20px 22px;}
.stat-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);margin-bottom:6px;}
.stat-value{font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--primary-dk);}
.stat-sub{font-size:12.5px;color:var(--text3);margin-top:3px;}
.border-primary{border-left:4px solid var(--primary-dk);}
.border-accent{border-left:4px solid var(--accent);}
.border-warn{border-left:4px solid #B7770D;}
.border-muted{border-left:4px solid var(--border-dk);}
.border-success{border-left:4px solid #1E8449;}

.chart-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px;}
.chart-card{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:22px 24px;}
.chart-title{font-family:var(--font-serif);font-size:16px;font-weight:600;color:var(--primary-dk);margin-bottom:18px;}

/* workload */
.wl-row{display:flex;align-items:center;gap:14px;margin-bottom:14px;}
.wl-avatar{width:38px;height:38px;border-radius:50%;background:var(--primary-lt);color:var(--primary-dk);font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.wl-info{flex:1;}
.wl-name{font-size:14px;font-weight:600;color:var(--text);}
.wl-spec{font-size:12px;color:var(--text3);}
.wl-bar-bg{background:var(--surface2);border-radius:4px;height:6px;margin-top:5px;overflow:hidden;}
.wl-bar{background:var(--accent);height:6px;border-radius:4px;transition:width .5s ease;}
.wl-count{font-size:14px;font-weight:700;color:var(--primary-dk);flex-shrink:0;min-width:28px;text-align:right;}

/* MODAL */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:500;padding:24px;}
.modal-box{background:var(--surface);border-radius:12px;width:100%;max-width:880px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);}
.modal-box::-webkit-scrollbar{width:5px;}
.modal-box::-webkit-scrollbar-thumb{background:var(--border-dk);border-radius:3px;}
.modal-head{background:var(--primary-dk);padding:20px 28px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:10;border-radius:12px 12px 0 0;}
.modal-title{font-family:var(--font-serif);font-size:18px;color:#fff;}
.modal-acts{display:flex;gap:8px;}
.btn-mact{font-family:var(--font);font-size:13px;font-weight:600;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);padding:7px 16px;border-radius:4px;cursor:pointer;transition:.15s;}
.btn-mact:hover{background:rgba(255,255,255,.26);}
.btn-mclose{font-family:var(--font);font-size:13px;font-weight:600;background:transparent;color:#AED6F1;border:1px solid rgba(255,255,255,.18);padding:7px 16px;border-radius:4px;cursor:pointer;}
.modal-body{padding:28px;}

/* PREVIEW (inside modal) */
.prev-header{background:var(--primary-dk);border-radius:8px;padding:20px 24px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;}
.prev-logo-row{display:flex;align-items:center;gap:12px;}
.prev-logo{width:42px;height:42px;background:rgba(255,255,255,.18);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;}
.prev-hospital{font-family:var(--font-serif);font-size:17px;color:#fff;margin-bottom:2px;}
.prev-meta{font-size:12px;color:#AED6F1;line-height:1.7;}
.prev-badges{display:flex;flex-direction:column;gap:7px;align-items:flex-end;}
.prev-badge{background:rgba(255,255,255,.15);padding:7px 12px;border-radius:5px;text-align:right;}
.prev-badge-lbl{font-size:9.5px;color:#AED6F1;text-transform:uppercase;letter-spacing:.7px;margin-bottom:2px;}
.prev-badge-val{font-size:13px;font-weight:700;color:#fff;}

.prev-patient{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:18px;border-bottom:2px solid var(--border);}
.prev-name{font-family:var(--font-serif);font-size:20px;color:var(--primary-dk);margin-bottom:5px;}
.prev-pmeta{display:flex;gap:16px;flex-wrap:wrap;font-size:13.5px;color:var(--text2);}
.prev-pid{font-size:12px;font-weight:700;color:var(--accent);background:var(--primary-lt);padding:3px 11px;border-radius:4px;border:1px solid #AED6F1;display:inline-block;margin-bottom:7px;}
.prev-spent{font-size:12.5px;color:var(--text3);}
.prev-spent strong{font-size:17px;font-weight:700;color:var(--primary-dk);display:block;}

.prev-sec-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--primary);margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--border);display:flex;justify-content:space-between;}
.prev-sec-count{font-size:11px;color:var(--text3);background:var(--surface2);padding:2px 9px;border-radius:10px;border:1px solid var(--border);}

.prev-rx{border:1.5px solid var(--border);border-radius:8px;margin-bottom:12px;overflow:hidden;}
.prev-rx-head{background:var(--surface2);padding:11px 16px;border-bottom:1px solid var(--border);}
.prev-dx-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);margin-bottom:3px;}
.prev-dx{font-size:14.5px;font-weight:600;color:var(--text);}
.prev-rx-body{padding:14px 16px;}
.prev-sub{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--text3);margin-bottom:8px;}
.prev-tbl{width:100%;border-collapse:collapse;font-size:13.5px;}
.prev-tbl th{padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);border-bottom:1.5px solid var(--border);background:#E8EEF5;}
.prev-tbl td{padding:9px 12px;border-bottom:1px solid var(--border);color:var(--text);}
.prev-tbl tr:last-child td{border-bottom:none;}
.prev-tbl tbody tr:nth-child(even) td{background:#F8FAFE;}
.prev-tbl-wrap{border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:12px;}
.prev-rx-foot{display:flex;justify-content:space-between;font-size:12px;color:var(--text3);margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);}

.prev-bill{border:1.5px solid var(--border);border-radius:8px;padding:13px 18px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;}
.prev-bill-id{font-size:13px;font-weight:700;color:var(--primary-dk);margin-bottom:3px;}
.prev-bill-date{font-size:12px;color:var(--text3);}
.prev-bill-amt{font-size:17px;font-weight:700;color:var(--primary-dk);}
.prev-bill-method{font-size:11px;color:var(--text3);text-transform:uppercase;}

.prev-footer{margin-top:28px;padding-top:14px;border-top:1.5px solid var(--border);display:flex;justify-content:space-between;font-size:12px;color:var(--text3);}

.empty-state{font-size:13.5px;color:var(--text3);padding:16px 0;font-style:italic;}
.loading-state{text-align:center;padding:80px;color:var(--text3);}
.loading-state p{font-size:14px;margin-top:8px;}

@media(max-width:1024px){
  .workspace{grid-template-columns:1fr;}
  .stat-grid,.stat-grid-6{grid-template-columns:1fr 1fr;}
  .chart-row{grid-template-columns:1fr;}
}
`;

/* ── Summary Modal ── */
const SummaryModal = ({ patient, onClose }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rxRes, billRes, reportsRes] = await Promise.all([
          apiClient.get(`/prescriptions/${patient.id}`),
          apiClient.get(`/admin/billing/patient/${patient.id}`),
          apiClient.get(`/ai-reports/${patient.id}`),
        ]);
        const bills = billRes.data.bills || [];
        const invoices = await Promise.all(
          bills.map(b => apiClient.get(`/billing/invoice/${b.bill_id}`).then(r => r.data).catch(() => null))
        );
        setSummary({
          prescriptions: rxRes.data.prescriptions || [],
          bills:         bills,
          invoices:      invoices,
          aiReports:     reportsRes.data.ai_reports || [],
        });
      } catch { toast.error("Failed to load patient summary."); }
      finally  { setLoading(false); }
    })();
  }, [patient.id]);

  const handlePrint = () => {
    if (!summary) return;
    const html   = buildSummaryHTML(patient, summary);
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, { position:"absolute", width:"0", height:"0", border:"none" });
    document.body.appendChild(iframe);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(html);
    iframe.contentWindow.document.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  const handleDownload = () => {
    if (!summary) return;
    // Open in new tab and trigger browser print-to-PDF
    const html = buildSummaryHTML(patient, summary);
    const win  = window.open("", "_blank");
    if (!win) { toast.error("Allow popups to download PDF"); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
      // Browser "Save as PDF" dialog opens — user saves as PDF
    }, 600);
  };

  const totalSpent = summary?.bills?.reduce((s, b) => s + (b.net_total || 0), 0) || 0;
  const now        = new Date().toLocaleString("en-US", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <span className="modal-title">Patient Summary</span>
          <div className="modal-acts">
            <button className="btn-mact" onClick={handlePrint}>Print</button>
            <button className="btn-mact" onClick={handleDownload}>Download PDF</button>
            <button className="btn-mclose" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state"><p>Loading summary…</p></div>
          ) : (
            <>
              {/* Preview — what you see = what prints/downloads */}
              <div className="prev-header">
                <div className="prev-logo-row">
                  <div className="prev-logo">🏥</div>
                  <div>
                    <div className="prev-hospital">NiO's Hospital</div>
                    <div className="prev-meta">Birtamode-5, Jhapa, Nepal<br/>+977 023-123456</div>
                  </div>
                </div>
                <div className="prev-badges">
                  <div className="prev-badge">
                    <div className="prev-badge-lbl">Document Type</div>
                    <div className="prev-badge-val">Patient Summary</div>
                  </div>
                  <div className="prev-badge">
                    <div className="prev-badge-lbl">Generated</div>
                    <div className="prev-badge-val" style={{fontSize:12}}>{now}</div>
                  </div>
                </div>
              </div>

              {/* Patient info */}
              <div className="prev-patient">
                <div>
                  <div className="prev-name">{patient.name}</div>
                  <div className="prev-pmeta">
                    <span><strong>Age:</strong> {patient.age}</span>
                    <span><strong>Sex:</strong> {patient.sex}</span>
                    <span><strong>Contact:</strong> {patient.contact}</span>
                    <span><strong>Address:</strong> {patient.address}</span>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="prev-pid">{patient.patient_id}</div>
                  <div className="prev-spent">
                    Total Billed
                    <strong>Rs. {totalSpent.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Prescriptions */}
<div style={{ marginBottom: 24 }}>
  <div className="prev-sec-title">
    Prescriptions
    <span className="prev-sec-count">
      {summary.prescriptions.length}
    </span>
  </div>

  {summary.prescriptions.length === 0 ? (
    <div className="empty-state">
      No prescriptions on record.
    </div>
  ) : (
    summary.prescriptions.map((p, i) => (
      <div key={i} className="prev-rx">
        <div className="prev-rx-head">
          <div className="prev-dx-lbl">Diagnosis</div>
          <div className="prev-dx">
            {p.diagnosis || "—"}
          </div>
        </div>

        <div className="prev-rx-body">

          {p.medicines?.length > 0 && (
            <>
              <div className="prev-sub">
                Medicines Prescribed
              </div>

              <div className="prev-tbl-wrap">
                <table className="prev-tbl">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Dose</th>
                      <th>Timing</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.medicines.map((m, j) => (
                      <tr key={j}>
                        <td>{m.name || "—"}</td>
                        <td>{m.dose || "—"}</td>
                        <td>{m.timing || "—"}</td>
                        <td>{m.duration || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {p.tests?.filter(
            t =>
              t.test_name &&
              t.test_name.trim() !== "" &&
              t.test_name !== "No tests selected"
          ).length > 0 && (
            <>
              <div className="prev-sub" style={{ marginTop: 14 }}>
                Laboratory Tests
              </div>

              <div className="prev-tbl-wrap">
                <table className="prev-tbl">
                  <thead>
                    <tr>
                      <th>Test Name</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {p.tests
                      .filter(
                        t =>
                          t.test_name &&
                          t.test_name.trim() !== "" &&
                          t.test_name !== "No tests selected"
                      )
                      .map((t, j) => (
                        <tr key={j}>
                          <td>{t.test_name}</td>

                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 3,
                                fontSize: 11,
                                fontWeight: 700,
                                background:
                                  t.status === "Completed"
                                    ? "#D5F5E3"
                                    : "#FEF9E7",
                                color:
                                  t.status === "Completed"
                                    ? "#1E8449"
                                    : "#B7770D",
                              }}
                            >
                              {t.status || "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="prev-rx-foot">
            <span>{fmtDate(p.created_at)}</span>
            <span>Dr. {p.doctor || "Unknown"}</span>
          </div>
        </div>
      </div>
    ))
  )}
</div>

{/* 🔬 AI LAB REPORTS */}
<div style={{ marginBottom: 24 }}>
  <div className="prev-sec-title">
    Lab Reports
    <span className="prev-sec-count">
      {summary.aiReports?.length || 0}
    </span>
  </div>

  {!summary.aiReports || summary.aiReports.length === 0 ? (
    <div className="empty-state">
      No lab reports uploaded.
    </div>
  ) : (
    summary.aiReports.map((r, i) => {
      const analysis = r.ocr_report?.medical_analysis || {};

      return (
        <div key={i} className="prev-rx">
          <div className="prev-rx-head">
            <div className="prev-dx-lbl">Test</div>
            <div className="prev-dx">
              {r.test_name || "Lab Report"}
            </div>
          </div>

          <div className="prev-rx-body">

            {/* Table */}
            {Object.keys(analysis).length > 0 ? (
              <div className="prev-tbl-wrap">
                <table className="prev-tbl">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Value</th>
                      <th>Unit</th>
                      <th>Normal Range</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {Object.entries(analysis).map(([key, val], j) => {
                      const color =
                        val.status === "High"
                          ? "#C0392B"
                          : val.status === "Low"
                          ? "#B7770D"
                          : "#1E8449";

                      return (
                        <tr key={j}>
                          <td style={{ fontWeight: 600 }}>
                            {key}
                          </td>
                          <td>{val.value || "—"}</td>
                          <td>{val.unit || "—"}</td>
                          <td>{val.range || "—"}</td>
                          <td style={{ fontWeight: 700, color }}>
                            {val.status || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                No structured values extracted.
              </div>
            )}

            {/* Footer */}
            <div className="prev-rx-foot">
              <span>{fmtDate(r.created_at)}</span>
              <span
                style={{
                  color:
                    r.status === "Completed"
                      ? "#1E8449"
                      : "#B7770D",
                  fontWeight: 700,
                }}
              >
                {r.status || "Pending"}
              </span>
            </div>
          </div>
        </div>
      );
    })
  )}
</div>

              {/* Bills — exact invoice card matching CounterPortal */}
              <div style={{marginBottom:24}}>
                <div className="prev-sec-title">
                  Billing History
                  <span className="prev-sec-count">{summary.bills.length}</span>
                </div>
                {summary.bills.length === 0
                  ? <div className="empty-state">No billing records on file.</div>
                  : summary.bills.map((b, i) => {
                    const inv        = summary.invoices ? summary.invoices[i] : null;
                    const items      = (inv && inv.items) ? inv.items : (b.items || []);
                    const subtotal   = items.reduce((s,it) => s+(it.subtotal||(it.qty||1)*(it.price||0)), 0);
                    const discPct    = (inv && inv.bill && inv.bill.discount) ? inv.bill.discount : (b.discount || 0);
                    const discAmt    = (subtotal*discPct)/100;
                    const finalTotal = subtotal - discAmt;
                    const payDisplay = ((inv && inv.bill && inv.bill.payment_method) || b.payment_method || "cash").toUpperCase();
                    const billId     = b.bill_id;
                    return (
                      <div key={i} style={{background:"var(--surface)",borderRadius:10,overflow:"hidden",border:"1.5px solid var(--border)",marginBottom:20}}>
                        {/* Invoice head — dark header matching CounterPortal */}
                        <div style={{background:"var(--primary-dk)",padding:"22px 28px",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:20}}>
                          <div style={{display:"flex",alignItems:"center",gap:14}}>
                            <div style={{width:48,height:48,background:"rgba(255,255,255,.15)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🏥</div>
                            <div>
                              <div style={{fontFamily:"var(--font-serif)",fontSize:19,color:"#fff",marginBottom:3}}>NiO's Hospital</div>
                              <div style={{fontSize:12.5,color:"#AED6F1",lineHeight:1.7}}>Birtamode-5, Jhapa, Nepal<br/>+977 023-123456</div>
                            </div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
                            <div style={{background:"rgba(255,255,255,.15)",padding:"9px 14px",borderRadius:6,textAlign:"right"}}>
                              <div style={{fontSize:10,color:"#AED6F1",textTransform:"uppercase",letterSpacing:".7px",marginBottom:2}}>Invoice No.</div>
                              <div style={{fontSize:16,fontWeight:700,color:"#fff"}}>INV-{String(billId).padStart(4,"0")}</div>
                            </div>
                            <div style={{background:"rgba(255,255,255,.15)",padding:"9px 14px",borderRadius:6,textAlign:"right"}}>
                              <div style={{fontSize:10,color:"#AED6F1",textTransform:"uppercase",letterSpacing:".7px",marginBottom:2}}>Date</div>
                              <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{new Date().toISOString().slice(0,10)}</div>
                            </div>
                          </div>
                        </div>
                        {/* Invoice body */}
                        <div style={{padding:"24px 28px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
                            <div>
                              <div style={{fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".7px",color:"var(--text3)",marginBottom:4}}>Bill To</div>
                              <div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>{patient.name}</div>
                              <div style={{fontSize:13,color:"var(--text3)"}}>{patient.address || "—"}</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:10.5,fontWeight:700,textTransform:"uppercase",letterSpacing:".7px",color:"var(--text3)",marginBottom:4}}>Patient ID</div>
                              <div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>{patient.patient_id}</div>
                            </div>
                          </div>
                          <div style={{border:"1.5px solid var(--border)",borderRadius:6,overflow:"hidden"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
                              <thead>
                                <tr>
                                  {["Description","Qty","Unit Price","Amount"].map((h,hi) => (
                                    <th key={h} style={{padding:"9px 12px",textAlign:hi===3?"right":"left",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",color:"var(--text2)",borderBottom:"1.5px solid var(--border)",background:"#E8EEF5"}}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {items.length === 0
                                  ? <tr><td colSpan={4} style={{padding:"10px 12px",color:"var(--text3)",fontStyle:"italic"}}>No item details</td></tr>
                                  : items.map((it,j) => (
                                    <tr key={j} style={{background: j%2===1 ? "#F8FAFE" : "transparent"}}>
                                      <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",color:"var(--text)"}}>{it.name || it.medicine_name || (it.medicine_id===0 ? "Consultation / Lab Test" : "Medicine")}</td>
                                      <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",color:"var(--text)"}}>{it.qty||1}</td>
                                      <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",color:"var(--text)"}}>Rs. {Number(it.price||0).toLocaleString()}</td>
                                      <td style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",color:"var(--text)",textAlign:"right"}}>Rs. {Number(it.subtotal||(it.qty||1)*(it.price||0)).toLocaleString()}</td>
                                    </tr>
                                  ))
                                }
                              </tbody>
                            </table>
                          </div>
                          <div style={{maxWidth:280,marginLeft:"auto",marginTop:18,padding:"16px 18px",border:"1.5px solid var(--border)",borderRadius:8}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:7}}><span>Subtotal</span><span>Rs. {subtotal.toLocaleString()}</span></div>
                            {discPct > 0 && (
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:7,color:"var(--accent)"}}><span>Discount ({discPct}%)</span><span>- Rs. {discAmt.toFixed(2)}</span></div>
                            )}
                            <div style={{fontSize:16,fontWeight:700,color:"var(--primary-dk)",borderTop:"1.5px solid var(--border)",paddingTop:10,marginTop:8,display:"flex",justifyContent:"space-between"}}><span>Grand Total</span><span>Rs. {finalTotal.toFixed(2)}</span></div>
                            <div style={{fontSize:12,color:"var(--text3)",borderTop:"1px dashed var(--border)",marginTop:10,paddingTop:10}}>Payment Method: <strong>{payDisplay}</strong></div>
                          </div>
                        </div>
                        <div style={{padding:"14px 28px",borderTop:"1.5px solid var(--border)",fontSize:13,color:"var(--text3)"}}>Generated by <strong>Admin — NiO's Hospital</strong></div>
                      </div>
                    );
                  })
                }
              </div>

              {/* Footer */}
              <div className="prev-footer">
                <span>Generated by <strong>{"Admin"}</strong> — NiO's Hospital Admin</span>
                <span><strong>MeroSwasthya</strong> Health System</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Analytics Tab ── */
const AnalyticsTab = ({ doctors }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get("/admin/analytics-v2/");
        setData(res.data);
      } catch { toast.error("Failed to load analytics."); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="loading-state"><p>Loading analytics…</p></div>;
  if (!data)   return <div className="loading-state"><p>No data available.</p></div>;

  const maxWork = Math.max(...(data.doctor_workload||[]).map(d => d.patients_month), 1);

  return (
    <>
      {/* Row 1 — visits */}
      <div className="stat-grid" style={{marginBottom:16}}>
        <div className="stat-card border-primary">
          <div className="stat-label">Total Patients</div>
          <div className="stat-value">{data.total_patients?.toLocaleString()}</div>
          <div className="stat-sub">Registered in system</div>
        </div>
        <div className="stat-card border-accent">
          <div className="stat-label">Visits This Month</div>
          <div className="stat-value">{data.visits_month}</div>
          <div className="stat-sub">{data.visits_week} this week · {data.visits_today} today</div>
        </div>
        <div className="stat-card border-success">
          <div className="stat-label">ML Forecast — Next Month</div>
          <div className="stat-value">Rs. {Number(data.forecast_next_month||0).toLocaleString()}</div>
          <div className="stat-sub">Based on last 12 months trend</div>
        </div>
      </div>

      {/* Row 2 — revenue breakdown */}
      <div className="stat-grid" style={{marginBottom:24}}>
        <div className="stat-card border-primary">
          <div className="stat-label">Total Revenue</div>
          <div className="stat-value">Rs. {Number(data.total_revenue||0).toLocaleString()}</div>
          <div className="stat-sub">
            Pharmacy Rs. {Number(data.pharmacy_revenue||0).toLocaleString()} ·
            Consult Rs. {Number(data.doctor_revenue||0).toLocaleString()} ·
            Tests Rs. {Number(data.test_revenue||0).toLocaleString()}
          </div>
        </div>
        <div className="stat-card border-accent">
          <div className="stat-label">This Month</div>
          <div className="stat-value">Rs. {Number(data.revenue_month||0).toLocaleString()}</div>
          <div className="stat-sub">Rs. {Number(data.revenue_week||0).toLocaleString()} this week</div>
        </div>
        <div className="stat-card border-muted">
          <div className="stat-label">Today</div>
          <div className="stat-value">Rs. {Number(data.revenue_today||0).toLocaleString()}</div>
          <div className="stat-sub">Current day revenue</div>
        </div>
      </div>

      {/* Charts */}
      <div className="chart-row">

        {/* Revenue by month */}
        <div className="chart-card">
          <div className="chart-title">Revenue — Last 6 Months</div>
          {data.revenue_by_month?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.revenue_by_month} margin={{top:8,right:16,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{fontSize:11,fill:"#6B7280"}} axisLine={false} tickLine={false}
                  tickFormatter={v=>v.split(" ")[0]} />
                <YAxis tick={{fontSize:11,fill:"#6B7280"}} axisLine={false} tickLine={false}
                  tickFormatter={v=>`Rs.${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{fontFamily:"IBM Plex Sans",fontSize:13,border:"1px solid #CDD5DF",borderRadius:6}}
                  formatter={v=>[`Rs. ${Number(v).toLocaleString()}`,"Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke="#154360" strokeWidth={2.5}
                  dot={{fill:"#154360",r:4,strokeWidth:0}} activeDot={{r:6}}/>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{height:220,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",fontSize:14}}>No billing data yet</div>
          )}
        </div>

        {/* Doctor Workload THIS MONTH */}
        <div className="chart-card">
          <div className="chart-title">Doctor Workload — This Month</div>
          {data.doctor_workload?.length > 0 ? (
            <>
              {data.doctor_workload.map((d,i) => (
                <div key={i} className="wl-row">
                  <div className="wl-avatar">{(d.name||"D")[0].toUpperCase()}</div>
                  <div className="wl-info">
                    <div className="wl-name">Dr. {d.name}</div>
                    <div className="wl-spec">{d.specialization} · {d.patients_month} patients this month</div>
                    <div className="wl-bar-bg">
                      <div className="wl-bar" style={{width:`${maxWork > 0 ? (d.patients_month/maxWork)*100 : 0}%`}} />
                    </div>
                  </div>
                  <div className="wl-count">{d.patients_month}</div>
                </div>
              ))}
              <div style={{marginTop:8,fontSize:12,color:"var(--text3)",borderTop:"1px dashed var(--border)",paddingTop:8,display:"flex",justifyContent:"space-between"}}>
                <span>Busiest: <strong style={{color:"var(--primary-dk)"}}>{data.doctor_workload[0]?.name||"—"}</strong></span>
                <span>All time: <strong style={{color:"var(--text2)"}}>{data.doctor_workload.reduce((s,d)=>s+d.patient_count,0)} patients</strong></span>
              </div>
            </>
          ) : (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:180,color:"var(--text3)",fontSize:14}}>No doctors in system</div>
          )}
        </div>
      </div>
    </>
  );
};

/* ── Patients Tab ── */
const PatientsTab = () => {
  const [patients,    setPatients]    = useState([]);
  const [filtered,    setFiltered]    = useState([]);
  const [search,      setSearch]      = useState("");
  const [selected,    setSelected]    = useState(null);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      patients
        .filter(p => showDeleted ? true : !p.is_deleted)
        .filter(p =>
          (p.name||"").toLowerCase().includes(q)       ||
          (p.patient_id||"").toLowerCase().includes(q) ||
          (p.contact||"").toLowerCase().includes(q)    ||
          (p.address||"").toLowerCase().includes(q)
        )
    );
  }, [search, patients, showDeleted]);

  const fetchAll = async () => {
    try {
      const res = await apiClient.get("/admin/all-patients/");
      setPatients(res.data);
      setFiltered(res.data.filter(p => !p.is_deleted));
    } catch { toast.error("Failed to load patients."); }
  };

  const softDelete = async (id) => {
    if (!window.confirm("Remove this patient? Their data will be preserved.")) return;
    try {
      await apiClient.patch(`/admin/soft-delete-patient/${id}`, {});
      toast.success("Patient removed from active records."); fetchAll();
    } catch { toast.error("Failed to remove patient."); }
  };

  const restore = async (id) => {
    try {
      await apiClient.patch(`/admin/restore-patient/${id}`, {});
      toast.success("Patient restored."); fetchAll();
    } catch { toast.error("Failed to restore patient."); }
  };

  return (
    <>
      {selected && <SummaryModal patient={selected} onClose={() => setSelected(null)} />}
      <div className="panel" style={{maxWidth:"100%"}}>
        <div className="panel-top">
          <div className="panel-heading">All Patients</div>
          <div className="panel-sub">View, search, manage and generate summaries for each patient</div>
        </div>
        <div className="panel-body">
          <div className="sec-hd">
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <span style={{fontSize:13,color:"var(--text3)"}}>{filtered.length} patient{filtered.length!==1?"s":""} shown</span>
              <label style={{display:"flex",alignItems:"center",gap:7,fontSize:13,color:"var(--text2)",cursor:"pointer"}}>
                <input type="checkbox" checked={showDeleted} onChange={e=>setShowDeleted(e.target.checked)} style={{accentColor:"var(--accent)"}} />
                Show removed patients
              </label>
            </div>
            <input className="search-input" placeholder="Search by name, ID, contact…" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>

          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>{["Patient ID","Name","Age","Sex","Contact","Address","Actions"].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.length===0 && <tr><td colSpan={7} className="tbl-empty">No patients found.</td></tr>}
                {filtered.map(p => (
                  <tr key={p.id} className={p.is_deleted?"deleted-row":""}>
                    <td style={{fontSize:13,color:"var(--text3)"}}>{p.patient_id}</td>
                    <td style={{fontWeight:600}}>{p.name}</td>
                    <td>{p.age}</td><td>{p.sex}</td>
                    <td>{p.contact}</td><td>{p.address}</td>
                    <td>
                      {!p.is_deleted ? (
                        <>
                          <button className="btn-view" onClick={()=>setSelected(p)}>Summary</button>
                          <button className="btn-rm"   onClick={()=>softDelete(p.id)}>Remove</button>
                        </>
                      ) : (
                        <button className="btn-save-spec" onClick={()=>restore(p.id)}>Restore</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

/* ── Main ── */
export default function AdminPortal() {
  const [activeTab,      setActiveTab]      = useState("users");
  const [fullName,       setFullName]       = useState("");
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [role,           setRole]           = useState("doctor");
  const [specialization, setSpecialization] = useState("");
  const [loading,        setLoading]        = useState(false);
  const [users,          setUsers]          = useState([]);
  const [filtered,       setFiltered]       = useState([]);
  const [search,         setSearch]         = useState("");
  const [specEdits,      setSpecEdits]      = useState({});

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(users.filter(u =>
      (u.full_name||"").toLowerCase().includes(q) ||
      (u.email||"").toLowerCase().includes(q)     ||
      (u.role||"").toLowerCase().includes(q)      ||
      (u.specialization||"").toLowerCase().includes(q)
    ));
  }, [search, users]);

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get("/admin/users/");
      setUsers(res.data); setFiltered(res.data);
      const edits = {};
      res.data.forEach(u => { edits[u.id] = u.specialization||""; });
      setSpecEdits(edits);
    } catch { toast.error("Failed to load users."); }
  };

  const handleCreateUser = async () => {
    if (!fullName||!email||!password) return toast.warn("Please fill all fields.");
    if (role==="doctor"&&!specialization) return toast.warn("Please select a specialization for the doctor.");
    try {
      setLoading(true);
      await apiClient.post(
        "/admin/create-user/",
        { full_name:fullName, email, password, role, specialization: role==="doctor"?specialization:"" }
      );
      toast.success("User created.");
      setFullName(""); setEmail(""); setPassword(""); setRole("doctor"); setSpecialization("");
      fetchUsers();
    } catch { toast.error("Failed to create user."); }
    finally { setLoading(false); }
  };

  const handleRemove = async (id) => {
    if (!window.confirm("Remove this user?")) return;
    try {
      await apiClient.delete(`/admin/delete-user/${id}`);
      toast.success("User removed."); fetchUsers();
    } catch { toast.error("Failed to remove user."); }
  };

  const handleSaveSpec = async (userId) => {
    try {
      await apiClient.patch(`/doctors/${userId}/specialization`, { specialization: specEdits[userId] });
      toast.success("Specialization updated."); fetchUsers();
    } catch { toast.error("Failed to update specialization."); }
  };

  const handleLogout = () => { localStorage.clear(); toast.info("Signed out."); setTimeout(()=>(window.location.href="/"),1000); };

  return (
    <>
      <style>{CSS}</style>
      <ToastContainer position="top-right" autoClose={3000} />

      <Topbar role="Admin Portal" />

      <nav className="tabs">
        {[{key:"users",label:"User Management"},{key:"patients",label:"Patients"},{key:"analytics",label:"Analytics"}].map(t=>(
          <button key={t.key} className={`tab ${activeTab===t.key?"active":""}`} onClick={()=>setActiveTab(t.key)}>{t.label}</button>
        ))}
      </nav>

      <div className="main-area">
        {activeTab==="users" && (
          <div className="workspace">
            <div className="panel">
              <div className="panel-top">
                <div className="panel-heading">Create New User</div>
                <div className="panel-sub">Add staff accounts to the system</div>
              </div>
              <div className="panel-body">
                <label className="f-lbl">Full Name</label>
                <input className="ctrl" placeholder="Full name…" value={fullName} onChange={e=>setFullName(e.target.value)} />
                <label className="f-lbl">Email Address</label>
                <input className="ctrl" type="email" placeholder="Email…" value={email} onChange={e=>setEmail(e.target.value)} />
                <label className="f-lbl">Password</label>
                <input className="ctrl" type="password" placeholder="Password…" value={password} onChange={e=>setPassword(e.target.value)} />
                <label className="f-lbl">Role</label>
                <div className="sel">
                  <select className="ctrl" value={role} onChange={e=>{setRole(e.target.value);setSpecialization("");}}>
                    {ROLES.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1).replace("_"," ")}</option>)}
                  </select>
                </div>
                {role==="doctor" && (
                  <div className="spec-box">
                    <div className="spec-box-lbl">Doctor Specialization</div>
                    <div className="sel">
                      <select className="ctrl" value={specialization} onChange={e=>setSpecialization(e.target.value)}>
                        <option value="">Select specialization…</option>
                        {SPECIALIZATIONS.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div className="divider"/>
                <button className="btn-create" onClick={handleCreateUser} disabled={loading}>
                  {loading?"Creating…":"Create User"}
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panel-top">
                <div className="panel-heading">System Users</div>
                <div className="panel-sub">Manage all staff accounts and doctor specializations</div>
              </div>
              <div className="panel-body">
                <div className="sec-hd">
                  <span style={{fontSize:13,color:"var(--text3)"}}>{filtered.length} user{filtered.length!==1?"s":""} found</span>
                  <input className="search-input" placeholder="Search by name, email, role…" value={search} onChange={e=>setSearch(e.target.value)} />
                </div>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr>{["ID","Name","Email","Role","Specialization","Action"].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {filtered.length===0 && <tr><td colSpan={6} className="tbl-empty">No users found.</td></tr>}
                      {filtered.map(u=>{
                        const bc=roleBadgeColor(u.role);
                        return (
                          <tr key={u.id}>
                            <td style={{color:"var(--text3)",fontSize:13}}>{u.id}</td>
                            <td style={{fontWeight:600}}>{u.full_name}</td>
                            <td style={{color:"var(--text2)"}}>{u.email}</td>
                            <td><span className="badge" style={{background:bc.bg,color:bc.color}}>{u.role}</span></td>
                            <td>
                              {u.role==="doctor"?(
                                <div className="spec-edit">
                                  <select className="spec-select" value={specEdits[u.id]||""} onChange={e=>setSpecEdits(p=>({...p,[u.id]:e.target.value}))}>
                                    <option value="">Not set</option>
                                    {SPECIALIZATIONS.map(s=><option key={s} value={s}>{s}</option>)}
                                  </select>
                                  <button className="btn-save-spec" onClick={()=>handleSaveSpec(u.id)}>Save</button>
                                </div>
                              ):<span style={{color:"var(--text3)",fontSize:13}}>—</span>}
                            </td>
                            <td><button className="btn-rm" onClick={()=>handleRemove(u.id)}>Remove</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab==="patients"  && <PatientsTab />}
        {activeTab==="analytics" && <AnalyticsTab doctors={users} />}
      </div>
    </>
  );
}
