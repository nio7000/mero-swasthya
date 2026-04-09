import { CURRENCY } from "../constants";

export const currency     = (n)           => `${CURRENCY} ${Number(n).toLocaleString()}`;
export const fmtNumber    = (n)           => Number(n).toLocaleString();
export const calcDiscount = (subtotal, pct) => (subtotal * pct) / 100;
export const calcNet      = (subtotal, pct) => subtotal - calcDiscount(subtotal, pct);
export const pct          = (part, total) => total > 0 ? Math.round((part / total) * 100) : 0;
