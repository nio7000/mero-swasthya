import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import apiClient from "../utils/api";
import { currency, fmtNumber } from "../utils/format";
import { STORAGE_KEYS } from "../constants";
import Topbar from "../components/Topbar";

const FORM_FIELDS = [
  ["name",         "Medicine Name",            true],
  ["strength",     "Strength (e.g. 500mg)",    false],
  ["category",     "Category",                 false],
  ["manufacturer", "Manufacturer",             false],
  ["price",        "Price (Rs.)",              false],
  ["quantity",     "Initial Quantity",         false],
  ["expiry_date",  "Expiry Date (YYYY-MM-DD)", false],
  ["threshold",    "Low Stock Threshold",      false],
];

const CSS = `
.tabs{display:flex;border-bottom:2px solid var(--border);padding:0 36px;background:var(--surface);}
.tab{font-family:var(--font);font-size:14px;font-weight:600;color:var(--text3);background:none;border:none;padding:14px 22px;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;transition:.15s;}
.tab:hover{color:var(--primary);}
.tab.active{color:var(--primary-dk);border-bottom-color:var(--primary-dk);}
.main{padding:32px 36px;min-height:calc(100vh - 116px);}
.stat-row{display:grid;gap:20px;margin-bottom:28px;}
.stat-3{grid-template-columns:repeat(3,1fr);}
.stat-card{background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:20px 22px;}
.stat-lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text3);margin-bottom:6px;}
.stat-val{font-family:var(--font-serif);font-size:28px;font-weight:600;color:var(--primary-dk);}
.stat-sub{font-size:12.5px;color:var(--text3);margin-top:3px;}
.bl-primary{border-left:4px solid var(--primary-dk);}
.bl-accent{border-left:4px solid var(--accent);}
.bl-success{border-left:4px solid var(--success);}
.conf-ring{display:flex;align-items:center;gap:20px;}
.conf-circle{position:relative;width:72px;height:72px;flex-shrink:0;}
.conf-circle svg{transform:rotate(-90deg);}
.conf-circle-bg{fill:none;stroke:var(--surface2);stroke-width:7;}
.conf-circle-fill{fill:none;stroke-width:7;stroke-linecap:round;transition:stroke-dashoffset .6s ease;}
.conf-pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-serif);font-size:16px;font-weight:700;color:var(--primary-dk);}
.conf-title{font-size:15px;font-weight:700;color:var(--text);margin-bottom:3px;}
.conf-sub{font-size:13px;color:var(--text3);}
.pa-panel{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:28px;}
.pa-panel-hd{padding:18px 24px;border-bottom:2px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
.pa-panel-title{font-family:var(--font-serif);font-size:17px;font-weight:600;color:var(--primary-dk);}
.pa-panel-sub{font-size:13px;color:var(--text3);margin-top:2px;}
.pa-panel-body{padding:22px 24px;}
.chart-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px;}
.top5-list{display:flex;flex-direction:column;gap:14px;}
.top5-row{display:flex;align-items:center;gap:14px;}
.top5-rank{width:28px;height:28px;border-radius:50%;background:var(--primary-lt);color:var(--primary-dk);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.top5-rank.gold{background:#FEF9C3;color:#92400E;}
.top5-info{flex:1;}
.top5-name{font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px;}
.top5-bar-bg{background:var(--surface2);border-radius:4px;height:7px;overflow:hidden;}
.top5-bar-fill{height:7px;border-radius:4px;transition:width .5s ease;}
.top5-right{text-align:right;flex-shrink:0;min-width:90px;}
.top5-sold{font-size:14px;font-weight:700;color:var(--primary-dk);}
.top5-conf{font-size:11.5px;color:var(--text3);margin-top:2px;}
.trend-up{color:var(--success);font-weight:700;font-size:13px;}
.trend-dn{color:var(--danger);font-weight:700;font-size:13px;}
.trend-st{color:var(--text3);font-weight:700;font-size:13px;}
.tbl-wrap{overflow-x:auto;}
.tbl-empty{text-align:center;padding:40px;color:var(--text3);}
.b-ok{background:var(--success-lt);color:var(--success);}
.b-exp{background:#F3F4F6;color:var(--text3);}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.btn-secondary{font-family:var(--font);font-size:14px;font-weight:600;background:var(--surface2);color:var(--text2);border:1.5px solid var(--border);padding:10px 22px;border-radius:6px;cursor:pointer;transition:.15s;}
.btn-secondary:hover{background:var(--border);}
.btn-edit{background:var(--warn-lt);color:var(--warn);border:1px solid #F0C674;border-radius:5px;padding:5px 12px;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;margin-right:6px;transition:.15s;}
.btn-edit:hover{background:#F0C674;}
.btn-del{background:var(--danger-lt);color:var(--danger);border:1px solid #F5B7B1;border-radius:5px;padding:5px 12px;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;transition:.15s;}
.btn-del:hover{background:var(--danger);color:#fff;}
.search-ctrl{padding:10px 14px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font);font-size:14px;background:var(--surface2);outline:none;width:260px;transition:.15s;}
.search-ctrl:focus{border-color:var(--accent);background:#fff;}
.search-ctrl::placeholder{color:var(--text3);}
.pa-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:500;padding:24px;}
.pa-modal-box{background:var(--surface);border-radius:12px;width:100%;max-width:620px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.25);}
.pa-modal-box::-webkit-scrollbar{width:5px;}
.pa-modal-box::-webkit-scrollbar-thumb{background:var(--border-dk);border-radius:3px;}
.modal-head{background:var(--primary-dk);padding:18px 24px;display:flex;justify-content:space-between;align-items:center;border-radius:12px 12px 0 0;}
.modal-head-title{font-family:var(--font-serif);font-size:17px;color:#fff;}
.modal-body{padding:24px;}
.loading-state{text-align:center;padding:80px;color:var(--text3);font-size:14px;}
@media(max-width:1100px){.chart-row{grid-template-columns:1fr;}.stat-3{grid-template-columns:1fr 1fr;}}
`;

/* Confidence Ring */
const ConfRing = ({ pct }) => {
  const r   = 28;
  const circ = 2 * Math.PI * r;
  const fill = circ - (pct / 100) * circ;
  const color = pct >= 70 ? "#1E8449" : pct >= 45 ? "#B7770D" : "#C0392B";
  return (
    <div className="conf-ring">
      <div className="conf-circle">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle className="conf-circle-bg" cx="36" cy="36" r={r}/>
          <circle className="conf-circle-fill"
            cx="36" cy="36" r={r}
            stroke={color}
            strokeDasharray={circ}
            strokeDashoffset={fill}/>
        </svg>
        <div className="conf-pct">{pct}%</div>
      </div>
      <div className="conf-info">
        <div className="conf-title">Model Confidence</div>
        <div className="conf-sub">
          {pct >= 70 ? "High accuracy — reliable forecast"
           : pct >= 45 ? "Moderate — more data improves accuracy"
           : "Low — add more sales history"}
        </div>
      </div>
    </div>
  );
};

export default function PharmacyAdminPage() {
  const [tab,       setTab]       = useState("inventory");
  const [inventory, setInventory] = useState([]);
  const [filtered,  setFiltered]  = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [mlData,    setMlData]    = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode,  setEditMode]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData,  setFormData]  = useState({});
  const [formType,  setFormType]  = useState("medicine");

  const fetchAll = async () => {
    try {
      const [s, m, a, ml] = await Promise.all([
        apiClient.get("/pharmacy-admin/dashboard/summary"),
        apiClient.get("/pharmacy-admin/medicines/"),
        apiClient.get("/pharmacy-admin/analytics/"),
        apiClient.get("/pharmacy-admin/ml-predictions/"),
      ]);
      setSummary(s.data);
      setInventory(m.data.medicines || []);
      setFiltered(m.data.medicines || []);
      setAnalytics(a.data);
      setMlData(ml.data);
    } catch { toast.error("Failed to load data."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEYS.TOKEN)) { window.location.href = "/"; return; }
    fetchAll();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? inventory.filter(m => m.name?.toLowerCase().includes(q)) : inventory);
  }, [search, inventory]);

  const openAdd    = () => { setEditMode(false); setEditingId(null); setFormData({}); setFormType("medicine"); setShowModal(true); };
  const openEdit   = (m) => { setEditMode(true); setEditingId(m.id); setFormData({ name:m.name, strength:m.strength, category:m.category, manufacturer:m.manufacturer, price:m.price, expiry_date:m.expiry_date, threshold:m.threshold, quantity:m.total_qty||0 }); setFormType("medicine"); setShowModal(true); };
  const openStock  = () => { setFormData({}); setFormType("stock"); setEditMode(false); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setFormData({}); setEditMode(false); setEditingId(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formType === "medicine") {
        editMode ? await apiClient.put(`/pharmacy-admin/medicines/${editingId}`, formData)
                 : await apiClient.post("/pharmacy-admin/medicines/", formData);
        toast.success(editMode ? "Medicine updated." : "Medicine added.");
      } else {
        await apiClient.post("/pharmacy-admin/stock/", formData);
        toast.success("Stock updated.");
      }
      closeModal(); fetchAll();
    } catch (e) { toast.error(e.response?.data?.detail || "Operation failed."); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete '${name}' permanently?`)) return;
    try { await apiClient.delete(`/pharmacy-admin/medicines/${id}`); toast.success("Deleted."); fetchAll(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed to delete."); }
  };

  const f = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-state">Loading pharmacy dashboard…</div>;

  const top5        = mlData?.top5 || [];
  const predictions = mlData?.predictions || [];
  const confidence  = mlData?.confidence || 0;
  const totalRev    = analytics?.total_revenue || 0;
  const topSeller   = top5[0]?.name || "—";
  const maxSold     = top5[0]?.total_sold || 1;

  // ML demand data: map by name for inventory lookup
  const mlMap = {};
  predictions.forEach(p => { mlMap[p.name] = p; });

  // Demand forecast chart data — backend gives monthly values, convert to weekly
  const forecastData = top5.map(p => ({
    name:     p.name.split(" ")[0],
    current:  parseFloat((p.monthly_avg / 4).toFixed(1)),
    forecast: parseFloat(((p.predicted_3m?.[0] || p.predicted_next_month || 0) / 4).toFixed(1)),
  }));

  return (
    <>
      <style>{CSS}</style>
      <ToastContainer position="top-right" autoClose={3000} />

      <Topbar role="Pharmacy Admin" />

      <nav className="tabs">
        {[["inventory","Inventory"],["analytics","Analytics"]].map(([k,l]) => (
          <button key={k} className={`tab ${tab===k?"active":""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      <div className="main">

        {/* ══ INVENTORY ══ */}
        {tab === "inventory" && (
          <>
            {summary && (
              <div className="stat-row stat-3">
                <div className="stat-card bl-primary">
                  <div className="stat-lbl">Total Medicines</div>
                  <div className="stat-val">{summary.total_medicines}</div>
                  <div className="stat-sub">In system</div>
                </div>
                <div className="stat-card bl-accent">
                  <div className="stat-lbl">Low Stock</div>
                  <div className="stat-val">{summary.low_stock_medicines}</div>
                  <div className="stat-sub">Below threshold</div>
                </div>
                <div className="stat-card bl-success">
                  <div className="stat-lbl">Expiring Soon</div>
                  <div className="stat-val">{summary.expiring_soon_count}</div>
                  <div className="stat-sub">Within 30 days</div>
                </div>
              </div>
            )}

            <div className="pa-panel">
              <div className="pa-panel-hd">
                <div>
                  <div className="pa-panel-title">Medicine Inventory</div>
                  <div className="pa-panel-sub">{filtered.length} medicines · demand data from ML model</div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <input className="search-ctrl" placeholder="Search medicines…" value={search} onChange={e => setSearch(e.target.value)} />
                  <button className="btn-secondary" onClick={openStock}>+ Stock</button>
                  <button className="btn-primary"   onClick={openAdd}>+ Add Medicine</button>
                </div>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      {["ID","Name","Manufacturer","Strength","Category","Price","Qty","Expiry","Status","Total Sold","Weekly Avg","Trend"].map(h=>(
                        <th key={h}>{h}</th>
                      ))}
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length===0 && <tr><td colSpan={13} className="tbl-empty">No medicines found.</td></tr>}
                    {filtered.map(m => {
                      const qty     = Array.isArray(m.stock) ? m.stock.reduce((a,s)=>a+(s.quantity||0),0) : 0;
                      const today   = new Date();
                      const exp     = new Date(m.expiry_date);
                      const expired = exp < today;
                      const expSoon = !expired && exp < new Date(Date.now()+30*86400000);
                      const low     = qty < m.threshold;
                      const scls    = expired?"b-exp":expSoon?"b-warn":low?"b-low":"b-ok";
                      const stxt    = expired?"Expired":expSoon?"Expiring":low?"Low Stock":"OK";
                      const ml      = mlMap[m.name] || null;
                      const trendEl = ml
                        ? ml.trend==="increasing"
                          ? <span className="trend-up">↑ Rising</span>
                          : ml.trend==="decreasing"
                            ? <span className="trend-dn">↓ Falling</span>
                            : <span className="trend-st">→ Stable</span>
                        : <span style={{color:"var(--text3)",fontSize:13}}>—</span>;
                      return (
                        <tr key={m.id}>
                          <td style={{color:"var(--text3)",fontSize:12}}>#{m.id}</td>
                          <td style={{fontWeight:600}}>{m.name}</td>
                          <td style={{fontSize:13}}>{m.manufacturer||"—"}</td>
                          <td>{m.strength||"—"}</td>
                          <td>{m.category||"—"}</td>
                          <td>{currency(m.price)}</td>
                          <td style={{fontWeight:600}}>{qty}</td>
                          <td style={{fontSize:13}}>{m.expiry_date||"—"}</td>
                          <td><span className={`badge ${scls}`}>{stxt}</span></td>
                          <td style={{fontWeight:600,color:"var(--primary-dk)"}}>{ml?.total_sold ?? "—"}</td>
                          <td style={{color:"var(--text2)"}}>{ml ? `${parseFloat((ml.monthly_avg/4).toFixed(1))}/wk` : "—"}</td>
                          <td>{trendEl}</td>
                          <td>
                            <button className="btn-edit" onClick={() => openEdit(m)}>Edit</button>
                            <button className="btn-del"  onClick={() => handleDelete(m.id, m.name)}>Remove</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ══ ANALYTICS ══ */}
        {tab === "analytics" && (
          <>
            {/* 1 + 2: Total Revenue + Top Seller + Confidence */}
            <div className="stat-row stat-3" style={{marginBottom:28}}>
              <div className="stat-card bl-primary">
                <div className="stat-lbl">Total Revenue</div>
                <div className="stat-val">{currency(totalRev)}</div>
                <div className="stat-sub">All time pharmacy sales</div>
              </div>
              <div className="stat-card bl-accent">
                <div className="stat-lbl">Top Seller</div>
                <div className="stat-val" style={{fontSize:20,marginTop:4}}>{topSeller}</div>
                <div className="stat-sub">{top5[0]?.total_sold || 0} units sold · {top5[0]?.trend === "increasing" ? "↑ Rising demand" : top5[0]?.trend === "decreasing" ? "↓ Falling demand" : "→ Stable demand"}</div>
              </div>
              <div className="stat-card bl-success" style={{justifyContent:"center"}}>
                <ConfRing pct={confidence} />
              </div>
            </div>

            {/* 3: Top 5 Selling Medicines */}
            <div className="chart-row">
              <div className="pa-panel">
                <div className="pa-panel-hd">
                  <div>
                    <div className="pa-panel-title">Top 5 Selling Medicines</div>
                    <div className="pa-panel-sub">Ranked by total units sold · per-medicine model confidence</div>
                  </div>
                </div>
                <div className="pa-panel-body">
                  {top5.length > 0 ? (
                    <div className="top5-list">
                      {top5.map((p, i) => (
                        <div key={i} className="top5-row">
                          <div className={`top5-rank ${i===0?"gold":""}`}>{i+1}</div>
                          <div className="top5-info">
                            <div className="top5-name">{p.name}</div>
                            <div className="top5-bar-bg">
                              <div className="top5-bar-fill" style={{
                                width:`${(p.total_sold/maxSold)*100}%`,
                                background: i===0?"#154360":"#2E86C1",
                              }}/>
                            </div>
                          </div>
                          <div className="top5-right">
                            <div className="top5-sold">{p.total_sold} units</div>
                            <div className="top5-conf">
                              {p.trend==="increasing"
                                ? <span className="trend-up">↑ Rising</span>
                                : p.trend==="decreasing"
                                  ? <span className="trend-dn">↓ Falling</span>
                                  : <span className="trend-st">→ Stable</span>}
                              &nbsp;· {p.confidence}% conf.
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="loading-state">No sales data yet</div>}
                </div>
              </div>

              {/* 4: Demand Forecast */}
              <div className="pa-panel">
                <div className="pa-panel-hd">
                  <div>
                    <div className="pa-panel-title">Demand Forecast</div>
                    <div className="pa-panel-sub">Current weekly avg vs ML predicted avg · top 5 medicines</div>
                  </div>
                </div>
                <div className="pa-panel-body">
                  {forecastData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={forecastData} margin={{top:0,right:0,left:0,bottom:0}}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0"/>
                          <XAxis dataKey="name" tick={{fontSize:12,fill:"#6B7280"}} axisLine={false} tickLine={false}/>
                          <YAxis tick={{fontSize:11,fill:"#6B7280"}} axisLine={false} tickLine={false}
                            tickFormatter={v=>`${v}`}/>
                          <Tooltip
                            contentStyle={{fontFamily:"IBM Plex Sans",fontSize:13,border:"1px solid #CDD5DF",borderRadius:6}}
                            formatter={(v,n)=>[`${v} units/wk`, n==="current"?"Current Avg":"ML Forecast"]}/>
                          <Bar dataKey="current"  name="current"  radius={[4,4,0,0]} fill="#AED6F1"/>
                          <Bar dataKey="forecast" name="forecast" radius={[4,4,0,0]} fill="#154360"/>
                        </BarChart>
                      </ResponsiveContainer>
                      <div style={{display:"flex",gap:20,marginTop:12,fontSize:12,color:"var(--text3)"}}>
                        <span style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{width:12,height:12,borderRadius:2,background:"#AED6F1",display:"inline-block"}}/>
                          Current weekly avg
                        </span>
                        <span style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{width:12,height:12,borderRadius:2,background:"#154360",display:"inline-block"}}/>
                          ML forecast (next 4 weeks)
                        </span>
                      </div>
                    </>
                  ) : <div className="loading-state">Not enough data</div>}
                </div>
              </div>
            </div>

            {/* 5: Forecast detail table — top 5 only */}
            <div className="pa-panel">
              <div className="pa-panel-hd">
                <div>
                  <div className="pa-panel-title">4-Week Forecast Detail</div>
                  <div className="pa-panel-sub">ML linear regression per medicine · trained on {mlData?.trained_on} records across {mlData?.weeks_of_data} weeks</div>
                </div>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>{["Medicine","Total Sold","Weekly Avg","Wk 1","Wk 2","Wk 3","Wk 4","Trend","Confidence"].map(h=><th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {top5.length===0 && <tr><td colSpan={9} className="tbl-empty">No data.</td></tr>}
                    {top5.map((p,i) => (
                      <tr key={i}>
                        <td style={{fontWeight:600}}>{p.name}</td>
                        <td>{p.total_sold}</td>
                        <td>{parseFloat((p.monthly_avg/4).toFixed(1))}/wk</td>
                        {(p.predicted_3m||[0,0,0]).concat([p.predicted_3m?.[2]||0]).map((v,j)=>(
                          <td key={j} style={{color:"var(--accent)",fontWeight:600}}>{v}</td>
                        ))}
                        <td>
                          {p.trend==="increasing"
                            ? <span className="trend-up">↑ Rising</span>
                            : p.trend==="decreasing"
                              ? <span className="trend-dn">↓ Falling</span>
                              : <span className="trend-st">→ Stable</span>}
                        </td>
                        <td>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{flex:1,background:"var(--surface2)",borderRadius:4,height:6,overflow:"hidden"}}>
                              <div style={{width:`${p.confidence}%`,height:6,borderRadius:4,background:p.confidence>=70?"var(--success)":p.confidence>=45?"var(--warn)":"var(--danger)"}}/>
                            </div>
                            <span style={{fontSize:13,fontWeight:600,color:"var(--text2)",minWidth:36}}>{p.confidence}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="pa-modal-overlay" onClick={e => e.target===e.currentTarget && closeModal()}>
          <div className="pa-modal-box">
            <div className="modal-head">
              <span className="modal-head-title">
                {formType==="stock"?"Add Stock":editMode?"Edit Medicine":"Add New Medicine"}
              </span>
              <button className="btn-out" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                {formType==="medicine" ? (
                  <div className="form-grid">
                    {FORM_FIELDS.map(([key,label,req]) => (
                      <div key={key} style={key==="name"?{gridColumn:"1/-1"}:{}}>
                        <label className="f-lbl">{label}</label>
                        <input className="ctrl" placeholder={label} value={formData[key]||""} onChange={e=>f(key,e.target.value)} required={req}/>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="f-lbl">Medicine ID</label>
                      <input className="ctrl" placeholder="Medicine ID…" value={formData.medicine_id||""} onChange={e=>f("medicine_id",e.target.value)} required/>
                    </div>
                    <div style={{marginTop:14}}>
                      <label className="f-lbl">Quantity to Add</label>
                      <input className="ctrl" placeholder="Quantity…" value={formData.quantity||""} onChange={e=>f("quantity",e.target.value)} required/>
                    </div>
                  </>
                )}
                <div className="divider"/>
                <div style={{display:"flex",gap:10}}>
                  <button type="submit" className="btn-primary" style={{flex:1}}>
                    {formType==="stock"?"Update Stock":editMode?"Save Changes":"Add Medicine"}
                  </button>
                  <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
