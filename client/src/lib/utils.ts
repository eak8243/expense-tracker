import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number for display with 2 decimal places.
 * Uses Math.round to avoid floating-point precision issues (e.g. 158.999... → 159.00).
 * Uses "en-US" locale so digits are always Western Arabic numerals.
 */
export function formatAmount(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "0.00";
  const raw = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(raw)) return "0.00";
  // Round to 2 decimal places before formatting to avoid floating-point drift
  const rounded = Math.round(raw * 100) / 100;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/**
 * Format THB amount with ฿ prefix.
 */
export function formatTHB(v: string | number | null | undefined): string {
  return `฿${formatAmount(v)}`;
}
