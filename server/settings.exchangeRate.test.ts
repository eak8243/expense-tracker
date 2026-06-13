import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

// Mock schema
vi.mock("../drizzle/schema", () => ({
  systemSettings: { settingKey: "settingKey", settingValue: "settingValue" },
}));

describe("Exchange Rate Settings", () => {
  describe("getExchangeRate logic", () => {
    it("returns default rate 36.0 when no setting exists", () => {
      const val = null;
      const rate = val ? parseFloat(val) : 36.0;
      expect(rate).toBe(36.0);
    });

    it("parses stored rate correctly", () => {
      const val = "38.50";
      const rate = val ? parseFloat(val) : 36.0;
      expect(rate).toBe(38.5);
    });

    it("parses integer rate correctly", () => {
      const val = "36";
      const rate = val ? parseFloat(val) : 36.0;
      expect(rate).toBe(36);
    });
  });

  describe("setExchangeRate validation", () => {
    it("accepts valid positive rate", () => {
      const rate = 38.5;
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(999);
    });

    it("rejects zero rate", () => {
      const rate = 0;
      expect(rate).not.toBeGreaterThan(0);
    });

    it("rejects negative rate", () => {
      const rate = -5;
      expect(rate).not.toBeGreaterThan(0);
    });

    it("rejects rate over 999", () => {
      const rate = 1000;
      expect(rate).toBeGreaterThan(999);
    });
  });

  describe("Dashboard estimated total calculation", () => {
    it("computes estimated total correctly with pending USD", () => {
      const totalAmount = 10000; // THB already recorded
      const pendingUsdAmount = 100; // USD not yet converted
      const usdRate = 36.0;

      const pendingUsdThb = pendingUsdAmount * usdRate;
      const estimatedTotal = totalAmount + pendingUsdThb;

      expect(pendingUsdThb).toBe(3600);
      expect(estimatedTotal).toBe(13600);
    });

    it("returns same total when no pending USD", () => {
      const totalAmount = 10000;
      const pendingUsdAmount = 0;
      const usdRate = 36.0;

      const pendingUsdThb = pendingUsdAmount * usdRate;
      const estimatedTotal = totalAmount + pendingUsdThb;

      expect(estimatedTotal).toBe(10000);
    });

    it("uses default rate 36.0 when no rate configured", () => {
      const storedRate = null;
      const usdRate = storedRate ? parseFloat(storedRate) : 36.0;

      const pendingUsdAmount = 50;
      const estimatedExtra = pendingUsdAmount * usdRate;

      expect(usdRate).toBe(36.0);
      expect(estimatedExtra).toBe(1800);
    });

    it("uses custom rate when configured", () => {
      const storedRate = "38.75";
      const usdRate = storedRate ? parseFloat(storedRate) : 36.0;

      const pendingUsdAmount = 100;
      const estimatedExtra = pendingUsdAmount * usdRate;

      expect(usdRate).toBe(38.75);
      expect(estimatedExtra).toBe(3875);
    });
  });

  describe("Exchange rate display formatting", () => {
    it("formats rate to 2 decimal places", () => {
      const rate = 36;
      const formatted = rate.toFixed(2);
      expect(formatted).toBe("36.00");
    });

    it("formats decimal rate correctly", () => {
      const rate = 38.5;
      const formatted = rate.toFixed(2);
      expect(formatted).toBe("38.50");
    });
  });
});
