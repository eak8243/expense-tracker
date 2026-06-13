// Storage helpers — supports Manus Built-in (Forge), Local Disk, and Custom S3
// Priority: DB settings (set via Admin UI) → Manus Built-in Forge fallback

import { ENV } from "./_core/env";
import { getStorageConfigFromDb } from "./routers/settings";
import path from "path";
import fs from "fs/promises";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

// ─── Local Disk helpers ───────────────────────────────────────────────────────

export const LOCAL_DISK_URL_PREFIX = "/local-storage/";

async function localDiskPut(
  basePath: string,
  key: string,
  data: Buffer | Uint8Array | string
): Promise<{ key: string; url: string }> {
  const filePath = path.join(basePath, key);
  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const buf = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
  await fs.writeFile(filePath, buf);
  return { key, url: `${LOCAL_DISK_URL_PREFIX}${key}` };
}

// ─── Manus Built-in (Forge) helpers ──────────────────────────────────────────

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error("Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY");
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

async function forgePut(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const { forgeUrl, forgeKey } = getForgeConfig();

  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);

  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }

  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });

  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }

  return { key, url: `/manus-storage/${key}` };
}

// ─── Custom S3 helpers ────────────────────────────────────────────────────────

async function customS3Put(
  cfg: NonNullable<Awaited<ReturnType<typeof getStorageConfigFromDb>>> & { type: "custom_s3" },
  key: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region ?? "us-east-1",
    credentials: {
      accessKeyId: cfg.accessKey!,
      secretAccessKey: cfg.secretKey!,
    },
    forcePathStyle: cfg.forcePathStyle !== false,
  });

  const body =
    typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);

  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  // Build public URL
  const base = cfg.publicUrlBase
    ? cfg.publicUrlBase.replace(/\/+$/, "")
    : cfg.forcePathStyle !== false
    ? `${cfg.endpoint!.replace(/\/+$/, "")}/${cfg.bucket}`
    : `${cfg.endpoint!.replace(/\/+$/, "")}`;

  const url = cfg.forcePathStyle !== false || cfg.publicUrlBase
    ? `${base}/${key}`
    : `${cfg.endpoint!.replace("://", `://${cfg.bucket}.`)}/${key}`;

  return { key, url };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));

  // Check if custom storage is configured in DB
  const customCfg = await getStorageConfigFromDb().catch(() => null);

  if (customCfg?.type === "local_disk") {
    return localDiskPut(customCfg.localDiskPath ?? "/app/uploads", key, data);
  }

  if (customCfg?.type === "custom_s3") {
    return customS3Put(customCfg as any, key, data, contentType);
  }

  // Fallback: Manus Built-in Forge storage
  return forgePut(key, data, contentType);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  const customCfg = await getStorageConfigFromDb().catch(() => null);

  if (customCfg?.type === "local_disk") {
    return { key, url: `${LOCAL_DISK_URL_PREFIX}${key}` };
  }

  if (customCfg?.type === "custom_s3") {
    const base = customCfg.publicUrlBase
      ? customCfg.publicUrlBase.replace(/\/+$/, "")
      : customCfg.forcePathStyle !== false
      ? `${customCfg.endpoint!.replace(/\/+$/, "")}/${customCfg.bucket}`
      : `${customCfg.endpoint!.replace(/\/+$/, "")}`;
    return { key, url: `${base}/${key}` };
  }

  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);

  const customCfg = await getStorageConfigFromDb().catch(() => null);

  if (customCfg?.type === "local_disk") {
    // Local disk: no signing needed, just return the proxy URL
    return `${LOCAL_DISK_URL_PREFIX}${key}`;
  }

  if (customCfg?.type === "custom_s3") {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    const client = new S3Client({
      endpoint: customCfg.endpoint,
      region: customCfg.region ?? "us-east-1",
      credentials: {
        accessKeyId: customCfg.accessKey!,
        secretAccessKey: customCfg.secretKey!,
      },
      forcePathStyle: customCfg.forcePathStyle !== false,
    });

    return getSignedUrl(client, new GetObjectCommand({ Bucket: customCfg.bucket, Key: key }), {
      expiresIn: 3600,
    });
  }

  // Fallback: Manus Forge signed URL
  const { forgeUrl, forgeKey } = getForgeConfig();
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);

  const resp = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }

  const { url } = (await resp.json()) as { url: string };
  return url;
}
