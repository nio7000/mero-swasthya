import { CURRENCY } from "../constants";

export const currency     = (n) => `${CURRENCY} ${n}`;
export const fmtNumber    = (n) => Number(n).toLocaleString();
export const calcDiscount = (subtotal, pct) => (subtotal * pct) / 100;
