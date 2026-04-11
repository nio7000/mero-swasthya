// Number and currency formatting helpers — used across all portals for consistent display.

import { CURRENCY } from "../constants";

// Formats a number as "Rs. 1,234" (or whatever the currency constant is set to)
export const currency     = (n)               => `${CURRENCY} ${Number(n).toLocaleString()}`;

// Formats a number with thousands separators, no currency symbol
export const fmtNumber    = (n)               => Number(n).toLocaleString();

// Calculates the discount amount from a subtotal and percentage
export const calcDiscount = (subtotal, pct)   => (subtotal * pct) / 100;

// Calculates the net total after applying a percentage discount
export const calcNet      = (subtotal, pct)   => subtotal - calcDiscount(subtotal, pct);

// Returns what percentage "part" is of "total" — returns 0 if total is 0 to avoid division errors
export const pct          = (part, total)     => total > 0 ? Math.round((part / total) * 100) : 0;
