export const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return String(d); }
};

export const fmtBillDate = (s) => {
  if (!s) return "";
  try {
    const d = new Date((s || "").replace(" ", "T"));
    if (isNaN(d)) return s;
    return d.toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return s; }
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
