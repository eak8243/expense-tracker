import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  HardDrive, Cloud, CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, AlertCircle, Info, Save, TestTube2,
} from "lucide-react";
import { toast } from "sonner";

const s3Schema = z.object({
  s3Endpoint: z.string().min(1, "กรุณาระบุ Endpoint URL"),
  s3Region: z.string().min(1, "กรุณาระบุ Region"),
  s3Bucket: z.string().min(1, "กรุณาระบุ Bucket Name"),
  s3AccessKey: z.string().min(1, "กรุณาระบุ Access Key"),
  s3SecretKey: z.string().min(1, "กรุณาระบุ Secret Key"),
  s3ForcePathStyle: z.boolean().default(true),
  s3PublicUrlBase: z.string().optional(),
});

type S3FormData = z.infer<typeof s3Schema>;

type TestResult = { success: boolean; message: string } | null;

export default function AdminStorageSettings() {
  const [storageType, setStorageType] = useState<"builtin" | "custom_s3">("builtin");
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);
  const [isTesting, setIsTesting] = useState(false);

  const { data: settings, isLoading, refetch } = trpc.settings.getStorageSettings.useQuery();

  const saveMutation = trpc.settings.saveStorageSettings.useMutation({
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่า Storage เรียบร้อยแล้ว");
      refetch();
    },
    onError: (err) => toast.error(err.message || "บันทึกล้มเหลว"),
  });

  const testMutation = trpc.settings.testStorageConnection.useMutation();

  const form = useForm<S3FormData>({
    resolver: zodResolver(s3Schema) as any,
    defaultValues: {
      s3Endpoint: "",
      s3Region: "us-east-1",
      s3Bucket: "",
      s3AccessKey: "",
      s3SecretKey: "",
      s3ForcePathStyle: true,
      s3PublicUrlBase: "",
    },
  });

  // Populate form from loaded settings
  useEffect(() => {
    if (settings) {
      const type = (settings.storage_type as "builtin" | "custom_s3") ?? "builtin";
      setStorageType(type);
      form.reset({
        s3Endpoint: settings.s3_endpoint ?? "",
        s3Region: settings.s3_region ?? "us-east-1",
        s3Bucket: settings.s3_bucket ?? "",
        s3AccessKey: settings.s3_access_key ?? "",
        s3SecretKey: settings.s3_secret_key ?? "",
        s3ForcePathStyle: settings.s3_force_path_style !== "false",
        s3PublicUrlBase: settings.s3_public_url_base ?? "",
      });
    }
  }, [settings]);

  const onSave = (data: S3FormData) => {
    saveMutation.mutate({
      storageType,
      ...(storageType === "custom_s3" ? data : {}),
    });
  };

  const onSaveBuiltin = () => {
    saveMutation.mutate({ storageType: "builtin" });
  };

  const onTest = async () => {
    const values = form.getValues();
    // Validate required fields first
    const valid = await form.trigger(["s3Endpoint", "s3Region", "s3Bucket", "s3AccessKey", "s3SecretKey"]);
    if (!valid) return;

    if (values.s3SecretKey.startsWith("••••")) {
      toast.error("กรุณากรอก Secret Key ใหม่เพื่อทดสอบการเชื่อมต่อ");
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync({
        endpoint: values.s3Endpoint,
        region: values.s3Region,
        bucket: values.s3Bucket,
        accessKey: values.s3AccessKey,
        secretKey: values.s3SecretKey,
        forcePathStyle: values.s3ForcePathStyle,
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "เชื่อมต่อล้มเหลว" });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="w-6 h-6 text-primary" />
            ตั้งค่า Storage
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            กำหนดที่จัดเก็บไฟล์หลักฐาน ใบเสร็จ และเอกสารแนบทั้งหมด
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Storage Type Selector */}
            <div className="grid grid-cols-2 gap-4">
              {/* Manus Built-in */}
              <button
                type="button"
                onClick={() => setStorageType("builtin")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  storageType === "builtin"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Cloud className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">Manus Built-in Storage</span>
                  {storageType === "builtin" && (
                    <Badge variant="default" className="text-xs ml-auto">ใช้งานอยู่</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  S3-compatible storage ที่ Manus จัดเตรียมให้ ไม่ต้องตั้งค่าเพิ่มเติม
                </p>
              </button>

              {/* Custom S3 */}
              <button
                type="button"
                onClick={() => setStorageType("custom_s3")}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  storageType === "custom_s3"
                    ? "border-orange-500 bg-orange-50/30"
                    : "border-border hover:border-orange-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive className="w-5 h-5 text-orange-500" />
                  <span className="font-semibold text-sm">Custom S3 / NAS</span>
                  {storageType === "custom_s3" && (
                    <Badge variant="secondary" className="text-xs ml-auto border-orange-300 text-orange-700">ใช้งานอยู่</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Synology NAS, MinIO, AWS S3, Cloudflare R2 หรือ S3-compatible อื่นๆ
                </p>
              </button>
            </div>

            {/* Builtin — just a save button */}
            {storageType === "builtin" && (
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium">Manus Built-in Storage พร้อมใช้งาน</p>
                      <p className="mt-0.5 text-xs text-blue-600">
                        ไฟล์ทั้งหมดจะถูกจัดเก็บใน Manus S3-compatible storage โดยอัตโนมัติ
                        ไม่ต้องตั้งค่าเพิ่มเติม
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={onSaveBuiltin}
                      disabled={saveMutation.isPending}
                      className="gap-2"
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      บันทึกการตั้งค่า
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Custom S3 Form */}
            {storageType === "custom_s3" && (
              <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base">การเชื่อมต่อ S3</CardTitle>
                    <CardDescription>
                      ตั้งค่าการเชื่อมต่อกับ S3-compatible storage เช่น Synology NAS (MinIO), AWS S3, Cloudflare R2
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Endpoint */}
                    <div className="space-y-1.5">
                      <Label>
                        Endpoint URL <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="https://your-nas.example.com:9000"
                        {...form.register("s3Endpoint")}
                        className={form.formState.errors.s3Endpoint ? "border-destructive" : ""}
                      />
                      {form.formState.errors.s3Endpoint && (
                        <p className="text-destructive text-xs">{form.formState.errors.s3Endpoint.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        สำหรับ AWS S3 ใช้: <code className="bg-muted px-1 rounded">https://s3.amazonaws.com</code>
                        &nbsp;| Cloudflare R2: <code className="bg-muted px-1 rounded">https://&lt;account&gt;.r2.cloudflarestorage.com</code>
                      </p>
                    </div>

                    {/* Region & Bucket */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Region <span className="text-destructive">*</span></Label>
                        <Input
                          placeholder="us-east-1"
                          {...form.register("s3Region")}
                          className={form.formState.errors.s3Region ? "border-destructive" : ""}
                        />
                        {form.formState.errors.s3Region && (
                          <p className="text-destructive text-xs">{form.formState.errors.s3Region.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bucket Name <span className="text-destructive">*</span></Label>
                        <Input
                          placeholder="expense-tracker"
                          {...form.register("s3Bucket")}
                          className={form.formState.errors.s3Bucket ? "border-destructive" : ""}
                        />
                        {form.formState.errors.s3Bucket && (
                          <p className="text-destructive text-xs">{form.formState.errors.s3Bucket.message}</p>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Access Key & Secret Key */}
                    <div className="space-y-1.5">
                      <Label>Access Key ID <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        {...form.register("s3AccessKey")}
                        className={form.formState.errors.s3AccessKey ? "border-destructive" : ""}
                      />
                      {form.formState.errors.s3AccessKey && (
                        <p className="text-destructive text-xs">{form.formState.errors.s3AccessKey.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Secret Access Key <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Input
                          type={showSecret ? "text" : "password"}
                          placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                          {...form.register("s3SecretKey")}
                          className={`pr-10 ${form.formState.errors.s3SecretKey ? "border-destructive" : ""}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {form.formState.errors.s3SecretKey && (
                        <p className="text-destructive text-xs">{form.formState.errors.s3SecretKey.message}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        ค่าที่แสดง ••••xxxx หมายความว่ามีการบันทึกไว้แล้ว — กรอกใหม่เฉพาะเมื่อต้องการเปลี่ยน
                      </p>
                    </div>

                    <Separator />

                    {/* Advanced Options */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium">ตัวเลือกขั้นสูง</p>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">Force Path Style</Label>
                          <p className="text-xs text-muted-foreground">
                            เปิดใช้สำหรับ MinIO, Synology NAS และ S3-compatible ส่วนใหญ่
                          </p>
                        </div>
                        <Switch
                          checked={form.watch("s3ForcePathStyle")}
                          onCheckedChange={(v) => form.setValue("s3ForcePathStyle", v)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Public URL Base (ไม่บังคับ)</Label>
                        <Input
                          placeholder="https://cdn.example.com"
                          {...form.register("s3PublicUrlBase")}
                        />
                        <p className="text-xs text-muted-foreground">
                          หากมี CDN หรือ custom domain สำหรับเข้าถึงไฟล์ ระบุที่นี่
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Test Result */}
                {testResult && (
                  <div
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      testResult.success
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <p className={`text-sm ${testResult.success ? "text-green-800" : "text-red-800"}`}>
                      {testResult.message}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onTest}
                    disabled={isTesting || saveMutation.isPending}
                    className="gap-2"
                  >
                    {isTesting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube2 className="w-4 h-4" />
                    )}
                    ทดสอบการเชื่อมต่อ
                  </Button>
                  <Button
                    type="submit"
                    disabled={saveMutation.isPending || isTesting}
                    className="gap-2"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    บันทึกการตั้งค่า
                  </Button>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    <strong>หมายเหตุ:</strong> การเปลี่ยน Storage จะมีผลกับไฟล์ที่อัปโหลดใหม่เท่านั้น
                    ไฟล์เดิมที่บันทึกไว้ใน Manus Built-in Storage จะยังคงเข้าถึงได้ตามปกติ
                  </p>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
