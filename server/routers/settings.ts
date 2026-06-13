import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { systemSettings } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";

// Storage setting keys
const STORAGE_KEYS = [
  "storage_type",        // "builtin" | "local_disk" | "custom_s3"
  "local_disk_path",     // absolute path for local disk storage (default: /app/uploads)
  "s3_endpoint",
  "s3_region",
  "s3_bucket",
  "s3_access_key",
  "s3_secret_key",       // stored encrypted (masked on read)
  "s3_force_path_style", // "true" | "false"
  "s3_public_url_base",  // optional custom CDN/public URL prefix
] as const;

type StorageKey = (typeof STORAGE_KEYS)[number];

// ─── Admin guard ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "เฉพาะผู้ดูแลระบบเท่านั้น" });
  }
  return next({ ctx });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, key))
    .limit(1);
  return rows[0]?.settingValue ?? null;
}

async function setSetting(
  key: string,
  value: string | null,
  description: string,
  userId: number,
  isEncrypted = false
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(systemSettings)
    .values({
      settingKey: key,
      settingValue: value,
      description,
      isEncrypted,
      updatedBy: userId,
    })
    .onDuplicateKeyUpdate({
      set: {
        settingValue: value,
        isEncrypted,
        updatedBy: userId,
      },
    });
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const settingsRouter = router({
  // ─── Get storage settings (secret key masked) ─────────────────────────────
  getStorageSettings: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;

    // Fetch all keys individually
    const result: Record<string, string | null> = {};
    for (const key of STORAGE_KEYS) {
      const val = await getSetting(key);
      // Mask secret key: show only last 4 chars
      if (key === "s3_secret_key" && val && val.length > 4) {
        result[key] = "••••••••" + val.slice(-4);
      } else {
        result[key] = val;
      }
    }
    return result;
  }),

  // ─── Save storage settings ─────────────────────────────────────────────────
  saveStorageSettings: adminProcedure
    .input(
      z.object({
        storageType: z.enum(["builtin", "local_disk", "custom_s3"]),
        localDiskPath: z.string().optional(),
        s3Endpoint: z.string().optional(),
        s3Region: z.string().optional(),
        s3Bucket: z.string().optional(),
        s3AccessKey: z.string().optional(),
        s3SecretKey: z.string().optional(), // empty string = keep existing
        s3ForcePathStyle: z.boolean().optional(),
        s3PublicUrlBase: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const uid = ctx.user.id;

      await setSetting("storage_type", input.storageType, "ประเภท Storage", uid);

      if (input.storageType === "local_disk") {
        const diskPath = input.localDiskPath?.trim() || "/app/uploads";
        await setSetting("local_disk_path", diskPath, "Local Disk Storage Path", uid);
      }

      if (input.storageType === "custom_s3") {
        if (input.s3Endpoint !== undefined)
          await setSetting("s3_endpoint", input.s3Endpoint || null, "S3 Endpoint URL", uid);
        if (input.s3Region !== undefined)
          await setSetting("s3_region", input.s3Region || null, "S3 Region", uid);
        if (input.s3Bucket !== undefined)
          await setSetting("s3_bucket", input.s3Bucket || null, "S3 Bucket Name", uid);
        if (input.s3AccessKey !== undefined)
          await setSetting("s3_access_key", input.s3AccessKey || null, "S3 Access Key", uid);
        // Only update secret key if a new value is provided (not masked placeholder)
        if (
          input.s3SecretKey !== undefined &&
          input.s3SecretKey !== "" &&
          !input.s3SecretKey.startsWith("••••")
        ) {
          await setSetting("s3_secret_key", input.s3SecretKey, "S3 Secret Key", uid, true);
        }
        if (input.s3ForcePathStyle !== undefined)
          await setSetting(
            "s3_force_path_style",
            input.s3ForcePathStyle ? "true" : "false",
            "Force Path Style",
            uid
          );
        if (input.s3PublicUrlBase !== undefined)
          await setSetting(
            "s3_public_url_base",
            input.s3PublicUrlBase || null,
            "Public URL Base",
            uid
          );
      }

      return { success: true };
    }),

  // ─── Test S3 connection ────────────────────────────────────────────────────
  testStorageConnection: adminProcedure
    .input(
      z.object({
        endpoint: z.string().min(1),
        region: z.string().min(1),
        bucket: z.string().min(1),
        accessKey: z.string().min(1),
        secretKey: z.string().min(1), // must be real key for test
        forcePathStyle: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      // Dynamically import @aws-sdk/client-s3 for test
      try {
        const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
        const client = new S3Client({
          endpoint: input.endpoint,
          region: input.region,
          credentials: {
            accessKeyId: input.accessKey,
            secretAccessKey: input.secretKey,
          },
          forcePathStyle: input.forcePathStyle,
        });

        // Try listing objects (just 1) to verify connection
        const cmd = new ListObjectsV2Command({ Bucket: input.bucket, MaxKeys: 1 });
        await client.send(cmd);

        return { success: true, message: "เชื่อมต่อสำเร็จ! Bucket พร้อมใช้งาน" };
      } catch (err: any) {
        const msg = err?.message || "เชื่อมต่อล้มเหลว";
        return {
          success: false,
          message: `เชื่อมต่อล้มเหลว: ${msg}`,
        };
      }
    }),

  // ─── Get current active storage type (for display) ────────────────────────
  getActiveStorageType: protectedProcedure.query(async () => {
    const storageType = await getSetting("storage_type");
    return { storageType: storageType ?? "builtin" };
  }),

  // Get USD exchange rate (all authenticated users)
  getExchangeRate: protectedProcedure.query(async () => {
    const val = await getSetting("usd_exchange_rate");
    const updatedAtVal = await getSetting("usd_exchange_rate_updated_at");
    const updatedByName = await getSetting("usd_exchange_rate_updated_by_name");
    return {
      rate: val ? parseFloat(val) : 36.0,
      updatedAt: updatedAtVal ? new Date(updatedAtVal) : null,
      updatedByName: updatedByName ?? null,
    };
  }),

  // Set USD exchange rate (admin only)
  setExchangeRate: adminProcedure
    .input(
      z.object({
        rate: z.number().positive("อัตราแลกเปลี่ยนต้องมากกว่า 0").max(999, "อัตราแลกเปลี่ยนเกินขอบเขต"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const uid = ctx.user.id;
      await setSetting("usd_exchange_rate", String(input.rate), "อัตราแลกเปลี่ยน USD/THB เบื้องต้น", uid);
      await setSetting("usd_exchange_rate_updated_at", new Date().toISOString(), "วันที่อัปเดตอัตราแลกเปลี่ยน", uid);
      await setSetting("usd_exchange_rate_updated_by_name", ctx.user.name ?? ctx.user.username ?? "admin", "ผู้อัปเดตอัตราแลกเปลี่ยน", uid);
      return { success: true, rate: input.rate };
    }),
});

// ─── Export helper for storage.ts to read DB config ──────────────────────────
export async function getStorageConfigFromDb(): Promise<{
  type: "builtin" | "local_disk" | "custom_s3";
  localDiskPath?: string;
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKey?: string;
  secretKey?: string;
  forcePathStyle?: boolean;
  publicUrlBase?: string;
} | null> {
  try {
    const storageType = await getSetting("storage_type");
    if (!storageType || storageType === "builtin") return null;

    if (storageType === "local_disk") {
      const localDiskPath = await getSetting("local_disk_path");
      return {
        type: "local_disk",
        localDiskPath: localDiskPath ?? "/app/uploads",
      };
    }

    // custom_s3
    const endpoint = await getSetting("s3_endpoint");
    const region = await getSetting("s3_region");
    const bucket = await getSetting("s3_bucket");
    const accessKey = await getSetting("s3_access_key");
    const secretKey = await getSetting("s3_secret_key");
    const forcePathStyleStr = await getSetting("s3_force_path_style");
    const publicUrlBase = await getSetting("s3_public_url_base");

    if (!endpoint || !bucket || !accessKey || !secretKey) return null;

    return {
      type: "custom_s3",
      endpoint,
      region: region ?? "us-east-1",
      bucket,
      accessKey,
      secretKey,
      forcePathStyle: forcePathStyleStr !== "false",
      publicUrlBase: publicUrlBase ?? undefined,
    };
  } catch {
    return null;
  }
}
