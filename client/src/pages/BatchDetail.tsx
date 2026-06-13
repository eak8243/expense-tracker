import { useState, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Banknote,
  Calendar,
  FileText,
  Image,
  Download,
  Upload,
  Trash2,
  Loader2,
  X,
  ExternalLink,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { formatAmount } from "@/lib/utils";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  try {
    return format(new Date(d), "d MMM yyyy", { locale: th });
  } catch {
    return String(d);
  }
}

export default function BatchDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const batchId = parseInt(params.id);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: batch, isLoading } = trpc.batches.getById.useQuery({ id: batchId });

  const uploadProof = trpc.batches.uploadProof.useMutation({
    onSuccess: () => {
      toast.success("อัปโหลดหลักฐานสำเร็จ");
      utils.batches.getById.invalidate({ id: batchId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteBatch = trpc.batches.delete.useMutation({
    onSuccess: () => {
      toast.success("ลบกลุ่มเบิกรวมสำเร็จ รายการค่าใช้จ่ายถูกย้อนสถานะกลับเป็น 'ทำเบิกแล้ว'");
      navigate("/batches");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ไฟล์ขนาดเกิน 10MB");
      return;
    }
    const allowed = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("รองรับเฉพาะ PDF, JPG, PNG");
      return;
    }
    setUploadingProof(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await uploadProof.mutateAsync({
        batchId,
        fileBase64: base64,
        fileName: file.name,
        fileType: file.type,
      });
    } finally {
      setUploadingProof(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadProof = async () => {
    if (!batch?.proofFileKey) return;
    try {
      const result = await utils.client.batches.getProofUrl.query({ batchId });
      window.open(result.url, "_blank");
    } catch {
      toast.error("ไม่สามารถโหลดไฟล์ได้");
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!batch) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 max-w-4xl mx-auto text-center py-20">
          <Receipt className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">ไม่พบกลุ่มเบิกรวม</p>
          <Link href="/batches">
            <Button variant="link" className="mt-2">กลับไปรายการ</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/batches">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold font-mono">{batch.batchNo}</h1>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                เบิกรวม {batch.items?.length ?? 0} รายการ
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              สร้างโดย {batch.createdByName} · {formatDate(batch.createdAt)}
            </p>
          </div>
          {user?.role === "admin" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-red-400 hover:text-red-300 border-red-400/30 hover:bg-red-500/10"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              ลบกลุ่ม
            </Button>
          )}
        </div>

        {/* Summary card */}
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <Banknote className="h-5 w-5" />
                <span className="font-semibold">ยอดรวมที่ได้รับ</span>
              </div>
              <span className="text-2xl font-bold tabular-nums text-emerald-400">
                ฿{formatAmount(batch.totalAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                วันที่รับเงิน
              </span>
              <span className="font-medium">{formatDate(batch.reimbursedAt)}</span>
            </div>
            {batch.note && (
              <div className="text-sm text-muted-foreground border-t border-emerald-500/20 pt-3">
                <span className="font-medium text-foreground">หมายเหตุ:</span> {batch.note}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Proof attachment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              หลักฐานการรับเงิน
            </CardTitle>
          </CardHeader>
          <CardContent>
            {batch.proofFileName ? (
              <div className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-3">
                {batch.proofFileType?.startsWith("image/") ? (
                  <Image className="h-5 w-5 text-blue-400 shrink-0" />
                ) : (
                  <FileText className="h-5 w-5 text-red-400 shrink-0" />
                )}
                <span className="text-sm flex-1 truncate">{batch.proofFileName}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={handleDownloadProof}
                >
                  <Download className="h-3.5 w-3.5" />
                  ดูไฟล์
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">ยังไม่มีหลักฐานการรับเงิน</p>
              </div>
            )}

            {/* Upload proof button */}
            {user?.role !== "viewer" && (
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingProof}
                >
                  {uploadingProof ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {batch.proofFileName ? "เปลี่ยนหลักฐาน" : "อัปโหลดหลักฐาน"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              รายการค่าใช้จ่ายในกลุ่ม ({batch.items?.length ?? 0} รายการ)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {batch.items?.map((item: any) => (
              <Link key={item.expenseId} href={`/expenses/${item.expenseId}`}>
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{item.expenseNo}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{item.itemName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.companyName} · {formatDate(item.expenseDate)}
                      {item.userName && ` · ${item.userName}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold tabular-nums text-sm">฿{formatAmount(item.expenseAmount)}</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary shrink-0" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="h-5 w-5" />
              ยืนยันการลบกลุ่มเบิกรวม
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            การลบกลุ่ม <span className="font-mono font-semibold text-foreground">{batch.batchNo}</span> จะย้อนสถานะรายการค่าใช้จ่ายทั้ง{" "}
            <span className="font-semibold">{batch.items?.length}</span> รายการกลับเป็น "ทำเบิกแล้ว" ไม่สามารถกู้คืนได้
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteBatch.mutate({ id: batchId })}
              disabled={deleteBatch.isPending}
            >
              {deleteBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ยืนยันลบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
