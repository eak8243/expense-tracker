import type { Express } from "express";
import { ENV } from "./env";
import path from "path";
import fs from "fs/promises";
import { createReadStream, existsSync } from "fs";
import { lookup as mimeLookup } from "mime-types";
import { getStorageConfigFromDb } from "../routers/settings";

// ─── Local Disk proxy ─────────────────────────────────────────────────────────
function registerLocalDiskProxy(app: Express) {
  app.get("/local-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing file key");
      return;
    }

    try {
      // Get configured base path from DB
      const cfg = await getStorageConfigFromDb().catch(() => null);
      const basePath = cfg?.type === "local_disk" ? (cfg.localDiskPath ?? "/app/uploads") : "/app/uploads";
      const filePath = path.join(basePath, key);

      // Security: prevent path traversal
      const resolvedBase = path.resolve(basePath);
      const resolvedFile = path.resolve(filePath);
      if (!resolvedFile.startsWith(resolvedBase + path.sep) && resolvedFile !== resolvedBase) {
        res.status(403).send("Forbidden");
        return;
      }

      if (!existsSync(resolvedFile)) {
        res.status(404).send("File not found");
        return;
      }

      const stat = await fs.stat(resolvedFile);
      const contentType = mimeLookup(resolvedFile) || "application/octet-stream";

      res.set("Content-Type", contentType);
      res.set("Content-Length", String(stat.size));
      res.set("Cache-Control", "private, max-age=300");
      res.set("Access-Control-Allow-Origin", "*");

      const stream = createReadStream(resolvedFile);
      stream.pipe(res);
      stream.on("error", () => {
        if (!res.headersSent) res.status(500).send("Read error");
      });
    } catch (err) {
      console.error("[LocalDiskProxy] failed:", err);
      if (!res.headersSent) res.status(500).send("Storage error");
    }
  });
}

// ─── Manus Forge proxy ────────────────────────────────────────────────────────
function registerForgeProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      // Pipe the file content directly instead of redirecting
      const fileResp = await fetch(url);
      if (!fileResp.ok) {
        console.error(`[StorageProxy] S3 fetch error: ${fileResp.status}`);
        res.status(502).send("Failed to fetch file from storage");
        return;
      }

      const contentType = fileResp.headers.get("content-type") || "application/octet-stream";
      const contentLength = fileResp.headers.get("content-length");
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "private, max-age=300");
      res.set("Access-Control-Allow-Origin", "*");
      if (contentLength) {
        res.set("Content-Length", contentLength);
      }

      if (!fileResp.body) {
        res.status(502).send("Empty response from storage");
        return;
      }

      const reader = fileResp.body.getReader();
      res.status(200);
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            break;
          }
          const canContinue = res.write(Buffer.from(value));
          if (!canContinue) {
            await new Promise<void>((resolve) => res.once("drain", resolve));
          }
        }
      };
      await pump();
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      if (!res.headersSent) {
        res.status(502).send("Storage proxy error");
      }
    }
  });
}

// ─── Register both proxies ────────────────────────────────────────────────────
export function registerStorageProxy(app: Express) {
  registerLocalDiskProxy(app);
  registerForgeProxy(app);
}
