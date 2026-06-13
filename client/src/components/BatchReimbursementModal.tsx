import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileText,
  Image,
  X,
  Loader2,
  CheckCircle2,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { formatAmount } from "@/lib/utils";

interface SelectedExpense {
  id: number;
  expenseNo: string;
  itemName: string;
  amount: string | number;
  currency: string;
  companyName?: string;
}

interface BatchReimbursementModalProps {
  open: boolean;
  onClose: () => void;
  selectedExpenses: SelectedExpense[];
  onSuccess: () => void;
}

export function BatchReimbursementModal({
  open,
  onClose,
  selectedExpenses,
  onSuccess,
}: BatchReimbursementModalProps) {
  const [reimbursedAt, setReimbursedAt] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [note, setNote] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalAmount = selectedExpenses.reduce((sum, e) => {
    const n = typeof e.amount === "string" ? parseFloat(e.amount) : e.amount;
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const createBatch = trpc.batches.create.useMutation();
  const uploadProof = trpc.batches.uploadProof.useMutation();
  const utils = trpc.useUtils();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setProofFile(file);
  };

  const handleSubmit = async () => {
    if (!reimbursedAt) {
      toast.error("กรุณาระบุวันที่รับเงิน");
      return;
    }
    setIsSubmitting(true);
    try {
      // Create batch
      const result = await createBatch.mutateAsync({
        expenseIds: selectedExpenses.map((e) => e.id),
        reimbursedAt: new Date(reimbursedAt),
        note: note || undefined,
        totalAmount: totalAmount.toFixed(2),
      });

      // Upload proof if provided
      if (proofFile) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(proofFile);
        });

        await uploadProof.mutateAsync({
          batchId: result.batchId,
          fileBase64: base64,
          fileName: proofFile.name,
          fileType: proofFile.type,
        });
      }

      toast.success(`สร้างกลุ่มเบิกรวม ${result.batchNo} สำเร็จ`);
      utils.expenses.list.invalidate();
      utils.batches.list.invalidate();
      utils.dashboard.mySummary.invalidate();
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "เกิดข้อผิดพลาด");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setProofFile(null);
    setNote("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-400" />
            เบิกรวม ({selectedExpenses.length} รายการ)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected expenses list */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">
              รายการที่เลือก
            </Label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {selectedExpenses.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between text-sm bg-muted/30 rounded-md px-3 py-2"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">
                      {e.expenseNo}
                    </span>
                    <span className="truncate">{e.itemName}</span>
                    {e.companyName && (
                      <span className="text-xs text-muted-foreground">{e.companyName}</span>
                    )}
                  </div>
                  <span className="font-medium text-emerald-400 ml-2 shrink-0">
                    {formatAmount(e.amount)} {e.currency}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
            <span className="text-sm font-medium">ยอดรวมทั้งหมด</span>
            <span className="text-lg font-bold text-emerald-400">
              {formatAmount(totalAmount)} THB
            </span>
          </div>

          <Separator />

          {/* Reimbursed date */}
          <div className="space-y-1.5">
            <Label htmlFor="reimbursedAt">
              วันที่รับเงิน <span className="text-red-400">*</span>
            </Label>
            <Input
              id="reimbursedAt"
              type="date"
              value={reimbursedAt}
              onChange={(e) => setReimbursedAt(e.target.value)}
              max={format(new Date(), "yyyy-MM-dd")}
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="batchNote">หมายเหตุ</Label>
            <Textarea
              id="batchNote"
              placeholder="เช่น โอนผ่านธนาคาร SCB รายการที่ 3/2026"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          {/* Proof upload */}
          <div className="space-y-1.5">
            <Label>หลักฐานการรับเงิน (ไฟล์เดียวสำหรับทุกรายการ)</Label>
            {proofFile ? (
              <div className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5">
                {proofFile.type.startsWith("image/") ? (
                  <Image className="h-4 w-4 text-blue-400 shrink-0" />
                ) : (
                  <FileText className="h-4 w-4 text-red-400 shrink-0" />
                )}
                <span className="text-sm truncate flex-1">{proofFile.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {(proofFile.size / 1024).toFixed(0)} KB
                </span>
                <button
                  onClick={() => setProofFile(null)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg px-4 py-4 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors flex flex-col items-center gap-1.5"
              >
                <Upload className="h-5 w-5" />
                <span>คลิกเพื่อเลือกไฟล์ (PDF, JPG, PNG สูงสุด 10MB)</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedExpenses.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                ยืนยันเบิกรวม
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
