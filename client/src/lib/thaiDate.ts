const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalDate(value: Date | string) {
  if (value instanceof Date) return value;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), 12);
  }

  return new Date(value);
}

export function normalizeThaiDigits(value: string) {
  return value.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)));
}

/** Formats a date as Thai Buddhist Era date, e.g. 15/07/2569. */
export function formatThaiDateInput(value: Date | string | null | undefined) {
  if (!value) return "";

  const date = toLocalDate(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear() + 543}`;
}

/** Parses DD/MM/YYYY in either Buddhist Era (2569) or Common Era (2026). */
export function parseThaiDateInput(value: string): Date | null {
  const match = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})$/.exec(normalizeThaiDigits(value.trim()));
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const enteredYear = Number(match[3]);
  const year = enteredYear >= 2400 ? enteredYear - 543 : enteredYear;

  const date = new Date(year, month - 1, day, 12);
  const isValid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return isValid ? date : null;
}

export function isFutureDate(date: Date, today = new Date()) {
  const selected = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return selected > current;
}
