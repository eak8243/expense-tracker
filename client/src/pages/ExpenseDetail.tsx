import { useState, useRef, useCallback } from "react";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge, EXPENSE_TYPE_LABELS } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Upload,
  FileText,
  Image,
  Download,
  CheckCircle2,
  FileCheck,
  RotateCcw,
  Clock,
  Building2,
  Calendar,
  Tag,
  CreditCard,
  User,
  Loader2,
  AlertTriangle,
  Plus,
  Banknote,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";

function formatAmount(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "0.00";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  try {
    return format(new Date(d), "d MMM yyyy", { locale: th });
  } catch {
    return String(d);
  }
}

const ACTION_LABELS: Record<string, string> = {
  created: "สร้างรายการ",
  updated: "แก้ไขข้อมูล",
  status_changed: "เปลี่ยนสถานะ",
  attachment_uploaded: "อัปโหลดไฟล์",
  attachment_deleted: "ลบไฟล์",
  reimbursement_proof_uploaded: "อัปโหลดหลักฐานรับเงิน",
  iou_document_uploaded: "อัปโหลดเอกสาร IOU",
  reverted_status: "ย้อนสถานะ",
  admin_corrected: "แก้ไขโดยผู้ดูแล",
};

const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  expense_proof: "ใบเสร็จ/หลักฐาน",
  reimbursement_proof: "หลักฐานรับเงินคืน",
  iou_document: "เอกสาร IOU",
};

export default function ExpenseDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const expenseId = parseInt(params.id);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"expense_proof" | "reimbursement_proof" | "iou_document">("expense_proof");
  const [reimbursedAmount, setReimbursedAmount] = useState("");
  const [reimbursedDialogOpen, setReimbursedDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  // USD THB completion dialog
  const [thbDialogOpen, setThbDialogOpen] = useState(false);
  const [thbAmount, setThbAmount] = useState("");
  const [thbExchangeRate, setThbExchangeRate] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<Array<{ id: number; fileNameOriginal: string; fileType: string; fileSize: number; url: string }>>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const utils = trpc.useUtils();

  const openPreview = useCallback(async (files: any[], startIndex: number) => {
    try {
      const resolved = await Promise.all(
        files.map(async (f) => {
          const result = await utils.client.attachments.getDownloadUrl.query({ id: f.id });
          return { id: f.id, fileNameOriginal: f.fileNameOriginal, fileType: f.fileType, fileSize: f.fileSize, url: result.url };
        })
      );
      setPreviewFiles(resolved);
      setPreviewIndex(startIndex);
      setPreviewOpen(true);
    } catch {
      toast.error("ไม่สามารถโหลดไฟล์ preview ได้");
    }
  }, [utils]);

  const { data: expense, isLoading } = trpc.expenses.getById.useQuery({ id: expenseId });
  const { data: history } = trpc.expenses.history.useQuery({ id: expenseId, order: "desc" });
  const { data: batchInfo } = trpc.batches.getByExpenseId.useQuery(
    { expenseId },
    { enabled: !!expenseId }
  );

  const markClaimedMutation = trpc.expenses.markClaimed.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยนสถานะเป็นทำเบิกแล้วเรียบร้อย");
      utils.expenses.getById.invalidate({ id: expenseId });
      utils.dashboard.mySummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const markReimbursedMutation = trpc.expenses.markReimbursed.useMutation({
    onSuccess: () => {
      toast.success("เปลี่ยนสถานะเป็นได้เงินแล้วเรียบร้อย");
      setReimbursedDialogOpen(false);
      utils.expenses.getById.invalidate({ id: expenseId });
      utils.dashboard.mySummary.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const revertToDraftMutation = trpc.expenses.revertToDraft.useMutation({
    onSuccess: () => {
      toast.success("ย้อนสถานะเป็นร่างเรียบร้อย");
      utils.expenses.getById.invalidate({ id: expenseId });
    },
    onError: (err) => toast.error(err.message),
  });

  const revertToClaimedMutation = trpc.expenses.revertToClaimed.useMutation({
    onSuccess: () => {
      toast.success("ย้อนสถานะเป็นทำเบิกแล้วเรียบร้อย");
      utils.expenses.getById.invalidate({ id: expenseId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteExpenseMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบรายการเรียบร้อยแล้ว");
      utils.expenses.list.invalidate();
      navigate("/expenses");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateThbMutation = trpc.expenses.update.useMutation({
    onSuccess: () => {
      toast.success("บันทึกยอด THB เรียบร้อยแล้ว");
      setThbDialogOpen(false);
      setThbAmount("");
      setThbExchangeRate("");
      utils.expenses.getById.invalidate({ id: expenseId });
      utils.expenses.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAttachmentMutation = trpc.attachments.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบไฟล์เรียบร้อยแล้ว");
      utils.expenses.getById.invalidate({ id: expenseId });
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadAttachmentMutation = trpc.attachments.upload.useMutation({
    onSuccess: () => {
      toast.success("อัปโหลดไฟล์เรียบร้อยแล้ว");
      setUploadDialogOpen(false);
      utils.expenses.getById.invalidate({ id: expenseId });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("ขนาดไฟล์เกิน 10 MB");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(",")[1];
        await uploadAttachmentMutation.mutateAsync({
          expenseId,
          attachmentType: uploadType,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileData: base64,
        });
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
  };

  const openUploadDialog = (type: typeof uploadType) => {
    setUploadType(type);
    setUploadDialogOpen(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!expense) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">ไม่พบรายการค่าใช้จ่าย</p>
          <Link href="/expenses">
            <Button variant="link" className="mt-2">กลับไปรายการ</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const canEdit = user?.role !== "viewer" && expense.status !== "reimbursed" &&
    (user?.role === "admin" || expense.userId === user?.id);
  const canDelete = user?.role !== "viewer" && expense.status === "draft" &&
    (user?.role === "admin" || expense.userId === user?.id);
  const canMarkClaimed = canEdit && expense.status === "draft";
  const canMarkReimbursed = canEdit && expense.status === "claimed";
  const canRevertToDraft = canEdit && expense.status === "claimed";
  const canRevertToClaimed = user?.role === "admin" && expense.status === "reimbursed";
  const canUpload = canEdit;

  const expenseProofs = expense.attachments?.filter((a: any) => a.attachmentType === "expense_proof") ?? [];
  const iouDocs = expense.attachments?.filter((a: any) => a.attachmentType === "iou_document") ?? [];
  const reimbursementProofs = expense.attachments?.filter((a: any) => a.attachmentType === "reimbursement_proof") ?? [];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/expenses")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold">{expense.itemName}</h1>
                <StatusBadge status={expense.status} />
              </div>
              <p className="text-muted-foreground text-sm font-mono">{expense.expenseNo}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && (
              <Link href={`/expenses/${expenseId}/edit`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Edit className="w-3.5 h-3.5" />
                  แก้ไข
                </Button>
              </Link>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                ลบ
              </Button>
            )}
          </div>
        </div>

        {/* Status Actions */}
        {(canMarkClaimed || canMarkReimbursed || canRevertToDraft || canRevertToClaimed) && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm font-medium text-muted-foreground">เปลี่ยนสถานะ:</p>
                {canMarkClaimed && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-blue-600 hover:bg-blue-500"
                    onClick={() => markClaimedMutation.mutate({ id: expenseId })}
                    disabled={markClaimedMutation.isPending}
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    ทำเบิกแล้ว
                  </Button>
                )}
                {canMarkReimbursed && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                    onClick={() => setReimbursedDialogOpen(true)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ได้เงินแล้ว
                  </Button>
                )}
                {canRevertToDraft && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => revertToDraftMutation.mutate({ id: expenseId })}
                    disabled={revertToDraftMutation.isPending}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    ย้อนเป็นร่าง
                  </Button>
                )}
                {canRevertToClaimed && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => revertToClaimedMutation.mutate({ id: expenseId })}
                    disabled={revertToClaimedMutation.isPending}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    ย้อนเป็นทำเบิกแล้ว
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Expense Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">รายละเอียดค่าใช้จ่าย</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow icon={Building2} label="บริษัท" value={(expense as any).companyName ?? "—"} />
                  <InfoRow icon={Calendar} label="วันที่" value={formatDate(expense.expenseDate)} />
                  <InfoRow icon={Tag} label="หมวดหมู่" value={(expense as any).categoryName ?? "—"} />
                  <InfoRow icon={CreditCard} label="วิธีชำระ" value={(expense as any).paymentMethodName ?? "—"} />
                  <InfoRow icon={User} label="ผู้บันทึก" value={(expense as any).userName ?? "—"} />
                  <InfoRow
                    label="ประเภท"
                    value={EXPENSE_TYPE_LABELS[expense.expenseType] ?? expense.expenseType}
                  />
                </div>

                {expense.vendorName && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ผู้รับเงิน / ร้านค้า</p>
                    <p className="text-sm">{expense.vendorName}</p>
                  </div>
                )}

                {expense.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">รายละเอียด</p>
                    <p className="text-sm">{expense.description}</p>
                  </div>
                )}

                {expense.note && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">หมายเหตุ</p>
                    <p className="text-sm">{expense.note}</p>
                  </div>
                )}

                <Separator />

                {/* USD info card */}
                {(expense as any).foreignCurrency === "USD" && (
                  <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">จ่ายเป็น USD</span>
                      <span className="text-lg font-bold tabular-nums text-blue-700">
                        ${formatAmount((expense as any).foreignAmount)}
                      </span>
                    </div>
                    {(expense as any).exchangeRate && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>อัตราแลก</span>
                        <span>1 USD = ฿{formatAmount((expense as any).exchangeRate)}</span>
                      </div>
                    )}
                    {(!expense.amount || parseFloat(String(expense.amount)) === 0) ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-600 font-medium">ยังไม่ระบุยอด THB</span>
                        {(expense.status === "draft" || expense.status === "claimed") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              setThbAmount("");
                              setThbExchangeRate((expense as any).exchangeRate ?? "");
                              setThbDialogOpen(true);
                            }}
                          >
                            <Plus className="w-3 h-3" />
                            กรอกยอด THB
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>ยอด THB ที่ใช้เบิก</span>
                        <span className="font-semibold text-foreground">฿{formatAmount(expense.amount)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">ยอดเบิก (THB)</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {(!expense.amount || parseFloat(String(expense.amount)) === 0) && (expense as any).foreignCurrency === "USD" ? (
                      <span className="text-amber-500">รอยอด THB</span>
                    ) : (
                      <>฿{formatAmount(expense.amount)}</>
                    )}
                    <span className="text-sm font-normal text-muted-foreground ml-1">{expense.currency}</span>
                  </p>
                </div>

                {expense.status === "claimed" && expense.claimDate && (
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">วันที่ทำเบิก</p>
                    <p>{formatDate(expense.claimDate)}</p>
                  </div>
                )}

                {expense.status === "reimbursed" && (
                  <>
                    {expense.reimbursedDate && (
                      <div className="flex items-center justify-between text-sm">
                        <p className="text-muted-foreground">วันที่ได้รับเงิน</p>
                        <p>{formatDate(expense.reimbursedDate)}</p>
                      </div>
                    )}
                    {expense.reimbursedAmount && (
                      <div className="flex items-center justify-between text-sm">
                        <p className="text-muted-foreground">จำนวนที่ได้รับ</p>
                        <p className="font-semibold tabular-nums">฿{formatAmount(expense.reimbursedAmount)}</p>
                      </div>
                    )}
                    {batchInfo && (
                      <div className="mt-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                            <Banknote className="w-3.5 h-3.5" />
                            กลุ่มเบิกรวม
                          </span>
                          <Link href={`/batches/${batchInfo.batchId}`} className="flex items-center gap-1 text-emerald-400 hover:underline font-mono text-xs">
                            {batchInfo.batchNo}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">วันที่รับเงิน</span>
                          <span>{formatDate(batchInfo.reimbursedAt)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">ยอดรวมทั้งกลุ่ม</span>
                          <span className="font-semibold tabular-nums">฿{formatAmount(batchInfo.totalAmount)}</span>
                        </div>
                        {batchInfo.note && (
                          <p className="text-xs text-muted-foreground border-t border-emerald-500/20 pt-1.5">{batchInfo.note}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* IOU Info */}
            {expense.expenseType === "iou_advance" && (
              <Card className="border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-orange-700">ข้อมูลเงินทดรองจ่าย (IOU)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow label="เลข IOU" value={expense.iouNumber ?? "—"} />
                    <InfoRow label="วันที่ IOU" value={formatDate(expense.iouDate)} />
                    <InfoRow label="จำนวนเงิน IOU" value={expense.iouAmount ? `฿${formatAmount(expense.iouAmount)}` : "—"} />
                  </div>
                  {expense.iouNote && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">หมายเหตุ IOU</p>
                      <p className="text-sm">{expense.iouNote}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Attachments */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">ไฟล์แนบ</CardTitle>
                  {canUpload && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => openUploadDialog("expense_proof")}
                      >
                        <Plus className="w-3 h-3" />
                        ใบเสร็จ
                      </Button>
                      {expense.expenseType === "iou_advance" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={() => openUploadDialog("iou_document")}
                        >
                          <Plus className="w-3 h-3" />
                          IOU
                        </Button>
                      )}
                      {expense.status === "claimed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={() => openUploadDialog("reimbursement_proof")}
                        >
                          <Plus className="w-3 h-3" />
                          หลักฐานรับเงิน
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { type: "expense_proof", label: "ใบเสร็จ / หลักฐานการจ่ายเงิน", files: expenseProofs },
                  { type: "iou_document", label: "เอกสาร IOU", files: iouDocs },
                  { type: "reimbursement_proof", label: "หลักฐานการรับเงินคืน", files: reimbursementProofs },
                ].map(({ type, label, files }) => {
                  if (type === "iou_document" && expense.expenseType !== "iou_advance") return null;
                  return (
                    <div key={type}>
                      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
                      {files.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 italic">ยังไม่มีไฟล์</p>
                      ) : (
                        <div className="space-y-2">
                          {files.map((file: any, fileIdx: number) => (
                            <AttachmentItem
                              key={file.id}
                              file={file}
                              canDelete={canEdit && expense.status !== "reimbursed"}
                              onDelete={() => deleteAttachmentMutation.mutate({ id: file.id })}
                              onPreview={() => openPreview(files, fileIdx)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* File Preview Modal */}
          <FilePreviewModal
            files={previewFiles}
            initialIndex={previewIndex}
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
          />

          {/* History Timeline */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  ประวัติการเปลี่ยนแปลง
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!history || history.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีประวัติ</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                    <div className="space-y-4">
                      {history.map((h: any, idx: number) => (
                        <div key={h.id} className="flex gap-3 relative">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                            idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted border border-border"
                          }`}>
                            <div className="w-2 h-2 rounded-full bg-current" />
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <p className="text-xs font-medium">
                              {ACTION_LABELS[h.actionType] ?? h.actionType}
                            </p>
                            {h.oldStatus && h.newStatus && (
                              <p className="text-xs text-muted-foreground">
                                {h.oldStatus} → {h.newStatus}
                              </p>
                            )}
                            {h.fieldName && (
                              <p className="text-xs text-muted-foreground truncate">
                                {h.fieldName}: {h.oldValue} → {h.newValue}
                              </p>
                            )}
                            {h.attachmentFileNameOriginal && (
                              <p className="text-xs text-muted-foreground truncate">
                                {h.attachmentFileNameOriginal}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground/60 mt-0.5">
                              {h.performerName ?? "—"} · {formatDate(h.performedAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>อัปโหลด{ATTACHMENT_TYPE_LABELS[uploadType]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              รองรับไฟล์ PDF, JPG, JPEG, PNG ขนาดไม่เกิน 10 MB
            </p>
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">คลิกเพื่อเลือกไฟล์</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG ≤ 10 MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              ยกเลิก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reimbursed Dialog */}
      <Dialog open={reimbursedDialogOpen} onOpenChange={setReimbursedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการรับเงินคืน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              กรุณาตรวจสอบว่าได้แนบหลักฐานการรับเงินคืนแล้ว
            </p>
            <div className="space-y-1.5">
              <Label>จำนวนเงินที่ได้รับ (ถ้ามี)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={formatAmount(expense.amount)}
                  className="pl-7"
                  value={reimbursedAmount}
                  onChange={(e) => setReimbursedAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReimbursedDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={() =>
                markReimbursedMutation.mutate({
                  id: expenseId,
                  reimbursedAmount: reimbursedAmount ? parseFloat(reimbursedAmount) : undefined,
                })
              }
              disabled={markReimbursedMutation.isPending}
            >
              {markReimbursedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "ยืนยัน"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* THB Amount Completion Dialog */}
      <Dialog open={thbDialogOpen} onOpenChange={setThbDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-blue-600" />
              กรอกยอด THB สำหรับ USD
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ยอดนี้จะใช้เบิกจริงกับบริษัท — รายการนี้จ่ายเป็น <strong>${formatAmount((expense as any).foreignAmount)} USD</strong>
            </p>
            <div className="space-y-1.5">
              <Label>ยอด THB <span className="text-destructive">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  value={thbAmount}
                  onChange={(e) => setThbAmount(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>อัตราแลก (1 USD = ? THB)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
                <Input
                  type="number"
                  step="0.000001"
                  min="0"
                  placeholder="เช่น 36.50"
                  className="pl-7"
                  value={thbExchangeRate}
                  onChange={(e) => setThbExchangeRate(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">ไม่บังคับ</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThbDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                if (!thbAmount || parseFloat(thbAmount) <= 0) {
                  toast.error("กรุณาระบุยอด THB");
                  return;
                }
                updateThbMutation.mutate({
                  id: expenseId,
                  amount: parseFloat(thbAmount),
                  exchangeRate: thbExchangeRate ? parseFloat(thbExchangeRate) : undefined,
                });
              }}
              disabled={updateThbMutation.isPending}
            >
              {updateThbMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "บันทึกยอด THB"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              ยืนยันการลบ
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            คุณต้องการลบรายการ <strong>{expense.itemName}</strong> ({expense.expenseNo}) ใช่หรือไม่?
            การดำเนินการนี้ไม่สามารถยกเลิกได้
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteExpenseMutation.mutate({ id: expenseId })}
              disabled={deleteExpenseMutation.isPending}
            >
              {deleteExpenseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "ลบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function AttachmentItem({
  file,
  canDelete,
  onDelete,
  onPreview,
}: {
  file: any;
  canDelete: boolean;
  onDelete: () => void;
  onPreview?: () => void;
}) {
  const isImage = file.fileType?.startsWith("image/");
  const isPdf = file.fileType === "application/pdf";
  const utils = trpc.useUtils();

  const handleDownload = async () => {
    try {
      const result = await utils.client.attachments.getDownloadUrl.query({ id: file.id });
      window.open(result.url, "_blank");
    } catch {
      toast.error("ไม่สามารถดาวน์โหลดไฟล์ได้");
    }
  };

  const canPreview = isImage || isPdf;

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border hover:bg-muted/80 transition-colors">
      <button
        className="w-8 h-8 rounded-lg bg-background border flex items-center justify-center flex-shrink-0 hover:bg-accent/20 transition-colors"
        onClick={canPreview ? onPreview : handleDownload}
        title={canPreview ? "คลิกเพื่อ preview" : "ดาวน์โหลด"}
      >
        {isImage ? (
          <Image className="w-4 h-4 text-blue-500" />
        ) : (
          <FileText className="w-4 h-4 text-red-500" />
        )}
      </button>
      <button
        className="flex-1 min-w-0 text-left"
        onClick={canPreview ? onPreview : handleDownload}
        title={canPreview ? "คลิกเพื่อ preview" : "ดาวน์โหลด"}
      >
        <p className="text-xs font-medium truncate hover:text-primary transition-colors">{file.fileNameOriginal}</p>
        <p className="text-xs text-muted-foreground">
          {(file.fileSize / 1024).toFixed(0)} KB
          {canPreview && <span className="ml-1 text-primary/60">· คลิกเพื่อดู</span>}
        </p>
      </button>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} title="ดาวน์โหลด">
          <Download className="w-3.5 h-3.5" />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
            title="ลบไฟล์"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
