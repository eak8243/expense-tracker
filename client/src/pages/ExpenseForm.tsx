import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, ArrowLeft, Save, Receipt, Banknote,
  Paperclip, X, FileText, ImageIcon, Upload, CheckCircle2, Eye,
} from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  companyId: z.string().min(1, "กรุณาเลือกบริษัท"),
  expenseType: z.enum(["normal_expense", "iou_advance"]),
  itemName: z.string().min(1, "กรุณาระบุชื่อรายการ").max(255),
  expenseDate: z.string().min(1, "กรุณาระบุวันที่"),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  amount: z.string().min(1, "กรุณาระบุจำนวนเงิน"),
  currency: z.string().min(1).default("THB"),
  paymentMethodId: z.string().optional(),
  vendorName: z.string().optional(),
  iouNumber: z.string().optional(),
  iouDate: z.string().optional(),
  iouAmount: z.string().optional(),
  iouNote: z.string().optional(),
  note: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface PendingFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  errorMsg?: string;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ type }: { type: string }) {
  if (type === "application/pdf") return <FileText className="w-5 h-5 text-red-500" />;
  return <ImageIcon className="w-5 h-5 text-blue-500" />;
}

export default function ExpenseForm() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const isEdit = !!params.id;
  const expenseId = params.id ? parseInt(params.id) : undefined;

  const { data: masterData } = trpc.expenses.masterData.useQuery();
  const { data: existingExpense } = trpc.expenses.getById.useQuery(
    { id: expenseId! },
    { enabled: isEdit }
  );

  const utils = trpc.useUtils();

  // ─── File state ─────────────────────────────────────────────────────────────
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.attachments.upload.useMutation();
  const deleteAttachmentMutation = trpc.attachments.delete.useMutation({
    onSuccess: () => {
      utils.expenses.getById.invalidate({ id: expenseId! });
      toast.success("ลบไฟล์เรียบร้อยแล้ว");
    },
    onError: (err) => toast.error(err.message || "ลบไฟล์ไม่สำเร็จ"),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      expenseType: "normal_expense",
      currency: "THB",
    },
  });

  const expenseType = watch("expenseType");

  // Populate form when editing
  useEffect(() => {
    if (existingExpense) {
      reset({
        companyId: String(existingExpense.companyId),
        expenseType: existingExpense.expenseType as "normal_expense" | "iou_advance",
        itemName: existingExpense.itemName,
        expenseDate: existingExpense.expenseDate
          ? new Date(existingExpense.expenseDate).toISOString().split("T")[0]
          : "",
        categoryId: existingExpense.categoryId ? String(existingExpense.categoryId) : "",
        description: existingExpense.description ?? "",
        amount: existingExpense.amount,
        currency: existingExpense.currency,
        paymentMethodId: existingExpense.paymentMethodId
          ? String(existingExpense.paymentMethodId)
          : "",
        vendorName: existingExpense.vendorName ?? "",
        iouNumber: existingExpense.iouNumber ?? "",
        iouDate: existingExpense.iouDate
          ? new Date(existingExpense.iouDate).toISOString().split("T")[0]
          : "",
        iouAmount: existingExpense.iouAmount ?? "",
        iouNote: existingExpense.iouNote ?? "",
        note: existingExpense.note ?? "",
      });
    }
  }, [existingExpense, reset]);

  // ─── File handlers ───────────────────────────────────────────────────────────
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const newPending: PendingFile[] = [];
    for (const file of arr) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: ประเภทไฟล์ไม่ถูกต้อง (รองรับ PDF, JPG, PNG)`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: ขนาดไฟล์เกิน 10 MB`);
        continue;
      }
      newPending.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "pending",
        progress: 0,
      });
    }
    if (newPending.length > 0) {
      setPendingFiles((prev) => [...prev, ...newPending]);
    }
  }, []);

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // ─── Upload all pending files for a given expenseId ──────────────────────────
  const uploadPendingFiles = async (targetExpenseId: number): Promise<void> => {
    if (pendingFiles.length === 0) return;

    for (const pf of pendingFiles) {
      setPendingFiles((prev) =>
        prev.map((f) => (f.id === pf.id ? { ...f, status: "uploading", progress: 30 } : f))
      );
      try {
        const fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // strip data URL prefix
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(pf.file);
        });

        setPendingFiles((prev) =>
          prev.map((f) => (f.id === pf.id ? { ...f, progress: 60 } : f))
        );

        await uploadMutation.mutateAsync({
          expenseId: targetExpenseId,
          attachmentType: "expense_proof",
          fileName: pf.name,
          fileType: pf.type,
          fileSize: pf.size,
          fileData,
        });

        setPendingFiles((prev) =>
          prev.map((f) => (f.id === pf.id ? { ...f, status: "done", progress: 100 } : f))
        );
      } catch (err: any) {
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.id === pf.id
              ? { ...f, status: "error", progress: 0, errorMsg: err?.message || "อัปโหลดล้มเหลว" }
              : f
          )
        );
      }
    }
  };

  // ─── Create mutation ─────────────────────────────────────────────────────────
  const createMutation = trpc.expenses.create.useMutation();
  const updateMutation = trpc.expenses.update.useMutation();

  // Use a ref to always access the latest pendingFiles without stale closure
  const pendingFilesRef = useRef<PendingFile[]>([]);
  useEffect(() => {
    pendingFilesRef.current = pendingFiles;
  }, [pendingFiles]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = async (data: any) => {
    const payload = {
      companyId: parseInt(data.companyId),
      expenseType: data.expenseType,
      itemName: data.itemName,
      expenseDate: new Date(data.expenseDate),
      categoryId: data.categoryId ? parseInt(data.categoryId) : undefined,
      description: data.description || undefined,
      amount: parseFloat(data.amount),
      currency: data.currency,
      paymentMethodId: data.paymentMethodId ? parseInt(data.paymentMethodId) : undefined,
      vendorName: data.vendorName || undefined,
      iouNumber: data.iouNumber || undefined,
      iouDate: data.iouDate ? new Date(data.iouDate) : undefined,
      iouAmount: data.iouAmount ? parseFloat(data.iouAmount) : undefined,
      iouNote: data.iouNote || undefined,
      note: data.note || undefined,
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: expenseId!, ...payload });
        // Upload any new files added during edit
        const currentFiles = pendingFilesRef.current;
        if (currentFiles.length > 0) {
          toast.info("กำลังอัปโหลดไฟล์หลักฐาน...");
          await uploadPendingFiles(expenseId!);
          const failedCount = pendingFilesRef.current.filter((f) => f.status === "error").length;
          if (failedCount > 0) {
            toast.warning(`อัปเดตสำเร็จ แต่อัปโหลดไฟล์ล้มเหลว ${failedCount} ไฟล์`);
          } else {
            toast.success("อัปเดตค่าใช้จ่ายและอัปโหลดไฟล์เรียบร้อยแล้ว");
          }
        } else {
          toast.success("อัปเดตค่าใช้จ่ายเรียบร้อยแล้ว");
        }
        utils.expenses.list.invalidate();
        utils.expenses.getById.invalidate({ id: expenseId! });
        navigate(`/expenses/${expenseId}`);
      } else {
        const result = await createMutation.mutateAsync(payload);
        // Upload files right after expense is created — use ref to avoid stale closure
        const currentFiles = pendingFilesRef.current;
        if (currentFiles.length > 0) {
          toast.info("กำลังอัปโหลดไฟล์หลักฐาน...");
          await uploadPendingFiles(result.id);
          const failedCount = pendingFilesRef.current.filter((f) => f.status === "error").length;
          if (failedCount > 0) {
            toast.warning(`บันทึกสำเร็จ แต่อัปโหลดไฟล์ล้มเหลว ${failedCount} ไฟล์`);
          } else {
            toast.success(`บันทึกค่าใช้จ่าย ${result.expenseNo} และอัปโหลดไฟล์เรียบร้อยแล้ว`);
          }
        } else {
          toast.success(`บันทึกค่าใช้จ่าย ${result.expenseNo} เรียบร้อยแล้ว`);
        }
        utils.expenses.list.invalidate();
        utils.dashboard.mySummary.invalidate();
        navigate(`/expenses/${result.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending || isSubmitting;
  const hasUploadingFiles = pendingFiles.some((f) => f.status === "uploading");
  const isProcessing = isMutating || hasUploadingFiles;

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(isEdit ? `/expenses/${expenseId}` : "/expenses")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEdit ? "แก้ไขค่าใช้จ่าย" : "บันทึกค่าใช้จ่ายใหม่"}
            </h1>
            {existingExpense && (
              <p className="text-muted-foreground text-sm">{existingExpense.expenseNo}</p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" />
                ข้อมูลพื้นฐาน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Expense Type */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setValue("expenseType", "normal_expense")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    expenseType === "normal_expense"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="font-medium text-sm">ค่าใช้จ่ายทั่วไป</p>
                  <p className="text-xs text-muted-foreground mt-0.5">จ่ายเงินออกไปก่อน</p>
                </button>
                <button
                  type="button"
                  onClick={() => setValue("expenseType", "iou_advance")}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    expenseType === "iou_advance"
                      ? "border-orange-500 bg-orange-50"
                      : "border-border hover:border-orange-300"
                  }`}
                >
                  <p className="font-medium text-sm">เงินทดรองจ่าย (IOU)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">เบิกล่วงหน้าจากบริษัท</p>
                </button>
              </div>

              {/* Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>บริษัท <span className="text-destructive">*</span></Label>
                  <Select
                    value={watch("companyId") || ""}
                    onValueChange={(v) => setValue("companyId", v)}
                  >
                    <SelectTrigger className={errors.companyId ? "border-destructive" : ""}>
                      <SelectValue placeholder="เลือกบริษัท" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterData?.companies.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.companyId && <p className="text-destructive text-xs">{errors.companyId.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>วันที่ <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    {...register("expenseDate")}
                    className={errors.expenseDate ? "border-destructive" : ""}
                  />
                  {errors.expenseDate && <p className="text-destructive text-xs">{errors.expenseDate.message}</p>}
                </div>
              </div>

              {/* Item Name */}
              <div className="space-y-1.5">
                <Label>ชื่อรายการ <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="ระบุชื่อรายการค่าใช้จ่าย"
                  {...register("itemName")}
                  className={errors.itemName ? "border-destructive" : ""}
                />
                {errors.itemName && <p className="text-destructive text-xs">{errors.itemName.message}</p>}
              </div>

              {/* Category & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>หมวดหมู่</Label>
                  <Select
                    value={watch("categoryId") || "none"}
                    onValueChange={(v) => setValue("categoryId", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกหมวดหมู่" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ไม่ระบุ</SelectItem>
                      {masterData?.categories.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.categoryName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>วิธีชำระเงิน</Label>
                  <Select
                    value={watch("paymentMethodId") || "none"}
                    onValueChange={(v) => setValue("paymentMethodId", v === "none" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกวิธีชำระ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ไม่ระบุ</SelectItem>
                      {masterData?.paymentMethods.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.methodName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>จำนวนเงิน <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className={`pl-7 ${errors.amount ? "border-destructive" : ""}`}
                      {...register("amount")}
                    />
                  </div>
                  {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>สกุลเงิน</Label>
                  <Select
                    value={watch("currency") || "THB"}
                    onValueChange={(v) => setValue("currency", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="THB">THB - บาทไทย</SelectItem>
                      <SelectItem value="USD">USD - ดอลลาร์สหรัฐ</SelectItem>
                      <SelectItem value="EUR">EUR - ยูโร</SelectItem>
                      <SelectItem value="JPY">JPY - เยนญี่ปุ่น</SelectItem>
                      <SelectItem value="SGD">SGD - ดอลลาร์สิงคโปร์</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Vendor & Description */}
              <div className="space-y-1.5">
                <Label>ผู้รับเงิน / ร้านค้า</Label>
                <Input placeholder="ชื่อผู้รับเงินหรือร้านค้า" {...register("vendorName")} />
              </div>

              <div className="space-y-1.5">
                <Label>รายละเอียด</Label>
                <Textarea
                  placeholder="รายละเอียดเพิ่มเติม"
                  rows={2}
                  {...register("description")}
                />
              </div>
            </CardContent>
          </Card>

          {/* IOU Section */}
          {expenseType === "iou_advance" && (
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                  <Banknote className="w-4 h-4" />
                  ข้อมูลเงินทดรองจ่าย (IOU)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>เลข IOU <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="เช่น IOU-2024-001"
                      {...register("iouNumber")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>วันที่ IOU</Label>
                    <Input type="date" {...register("iouDate")} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>จำนวนเงิน IOU</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-7"
                      {...register("iouAmount")}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>หมายเหตุ IOU</Label>
                  <Textarea
                    placeholder="หมายเหตุเกี่ยวกับเงินทดรองจ่าย"
                    rows={2}
                    {...register("iouNote")}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── File Upload Section ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary" />
                ไฟล์หลักฐาน / ใบเสร็จ
                <span className="text-xs font-normal text-muted-foreground ml-1">(ไม่บังคับ)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  รองรับ PDF, JPG, PNG — สูงสุด 10 MB ต่อไฟล์
                </p>
              </div>

              {/* File List */}
              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  {pendingFiles.map((pf) => (
                    <div
                      key={pf.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        pf.status === "done"
                          ? "border-green-200 bg-green-50/50"
                          : pf.status === "error"
                          ? "border-destructive/30 bg-destructive/5"
                          : "border-border bg-muted/20"
                      }`}
                    >
                      <FileIcon type={pf.type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{pf.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">{formatFileSize(pf.size)}</p>
                          {pf.status === "uploading" && (
                            <span className="text-xs text-primary">กำลังอัปโหลด...</span>
                          )}
                          {pf.status === "done" && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> อัปโหลดสำเร็จ
                            </span>
                          )}
                          {pf.status === "error" && (
                            <span className="text-xs text-destructive">{pf.errorMsg}</span>
                          )}
                        </div>
                        {pf.status === "uploading" && (
                          <Progress value={pf.progress} className="h-1 mt-1.5" />
                        )}
                      </div>
                      {pf.status !== "uploading" && pf.status !== "done" && (
                        <button
                          type="button"
                          onClick={() => removeFile(pf.id)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Existing attachments (edit mode) */}
              {isEdit && existingExpense?.attachments && existingExpense.attachments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ไฟล์แนบที่มีอยู่แล้ว</p>
                  {existingExpense.attachments.map((att: any) => (
                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/10">
                      <FileIcon type={att.fileType} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.fileNameOriginal}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(att.fileSize)} · {att.attachmentType === "expense_proof" ? "หลักฐานค่าใช้จ่าย" : att.attachmentType === "reimbursement_proof" ? "หลักฐานรับเงินคืน" : "เอกสาร IOU"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`ลบไฟล์ "${att.fileNameOriginal}" ใช่หรือไม่?`)) {
                            deleteAttachmentMutation.mutate({ id: att.id });
                          }
                        }}
                        disabled={deleteAttachmentMutation.isPending}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        title="ลบไฟล์"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                ไฟล์จะถูกบันทึกเป็นหลักฐานค่าใช้จ่าย (expense_proof) — สามารถเพิ่มหลักฐานการรับเงินคืนได้ในหน้ารายละเอียดภายหลัง
              </p>
            </CardContent>
          </Card>

          {/* Note */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1.5">
                <Label>หมายเหตุ</Label>
                <Textarea
                  placeholder="หมายเหตุเพิ่มเติม"
                  rows={2}
                  {...register("note")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isEdit ? `/expenses/${expenseId}` : "/expenses")}
              disabled={isProcessing}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isProcessing} className="gap-2 min-w-36">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {hasUploadingFiles ? "กำลังอัปโหลดไฟล์..." : "กำลังบันทึก..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEdit ? "บันทึกการแก้ไข" : "บันทึกค่าใช้จ่าย"}
                  {pendingFiles.length > 0 && (
                    <span className="ml-1 text-xs opacity-80">
                      + {pendingFiles.length} ไฟล์
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
