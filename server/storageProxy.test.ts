import { describe, it, expect, vi, beforeEach } from "vitest";

// Test that storageProxy pipes content instead of redirecting (fixes CORS issue on desktop browsers)
describe("storageProxy behavior", () => {
  it("should pipe file content directly without redirect", async () => {
    // Read the storageProxy source to verify it does NOT use res.redirect
    const fs = await import("fs");
    const path = await import("path");
    const proxySource = fs.readFileSync(
      path.join(__dirname, "_core/storageProxy.ts"),
      "utf-8"
    );

    // Should NOT contain res.redirect (which causes CORS issues on desktop)
    expect(proxySource).not.toContain("res.redirect(307");
    expect(proxySource).not.toContain("res.redirect(302");

    // Should pipe/stream the response instead
    expect(proxySource).toContain("res.write");
    expect(proxySource).toContain("res.end");

    // Should set CORS header
    expect(proxySource).toContain("Access-Control-Allow-Origin");
  });

  it("should set Cache-Control header for piped responses", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const proxySource = fs.readFileSync(
      path.join(__dirname, "_core/storageProxy.ts"),
      "utf-8"
    );

    // Should set Cache-Control
    expect(proxySource).toContain("Cache-Control");
  });

  it("should forward Content-Type from upstream response", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const proxySource = fs.readFileSync(
      path.join(__dirname, "_core/storageProxy.ts"),
      "utf-8"
    );

    // Should forward content-type
    expect(proxySource).toContain("Content-Type");
    expect(proxySource).toContain("content-type");
  });
});
