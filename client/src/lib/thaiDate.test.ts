import { describe, expect, it } from "vitest";
import { formatThaiDateInput, isFutureDate, normalizeThaiDigits, parseThaiDateInput } from "./thaiDate";

describe("Thai date helpers", () => {
  it("formats a local date in Buddhist Era DD/MM/YYYY", () => {
    expect(formatThaiDateInput(new Date(2026, 6, 15, 12))).toBe("15/07/2569");
  });

  it("parses Buddhist Era and Common Era dates", () => {
    expect(parseThaiDateInput("15/07/2569")?.getFullYear()).toBe(2026);
    expect(parseThaiDateInput("15/07/2026")?.getFullYear()).toBe(2026);
  });

  it("accepts Thai numerals and rejects impossible dates", () => {
    expect(normalizeThaiDigits("๑๕/๐๗/๒๕๖๙")).toBe("15/07/2569");
    expect(parseThaiDateInput("31/02/2569")).toBeNull();
  });

  it("detects dates after today", () => {
    const today = new Date(2026, 6, 15, 12);
    expect(isFutureDate(new Date(2026, 6, 16, 12), today)).toBe(true);
    expect(isFutureDate(new Date(2026, 6, 15, 12), today)).toBe(false);
  });
});
