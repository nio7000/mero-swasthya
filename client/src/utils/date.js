/** Format a date string/object as "DD MMM YYYY" (e.g. "07 Apr 2026") */
export function fmtDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Format a bill date as "DD MMM YYYY, HH:MM" */
export function fmtBillDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Format a date as "DD MMM" (e.g. "07 Apr") */
export function fmtShort(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Return today's date as YYYY-MM-DD */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Return current datetime as ISO string */
export function nowISO() {
  return new Date().toISOString();
}

/** Return current 4-digit year */
export function currentYear() {
  return new Date().getFullYear();
}
