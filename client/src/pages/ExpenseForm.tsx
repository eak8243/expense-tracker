import { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, Save, Receipt, Banknote } from "lucide-react";
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

  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: (data) => {
      toast.success(`บันทึกค่าใช้จ่าย ${data.expenseNo} เรียบร้อยแล้ว`);
      utils.expenses.list.invalidate();
      utils.dashboard.mySummary.invalidate();
      navigate("/expenses");
    },
    onError: (err) => {
      toast.error(err.message || "เกิดข้อผิดพลาดในการบันทึก");
    },
  });

  const updateMutation = trpc.expenses.update.useMutation({
    onSuccess: () => {
      toast.success("อัปเดตค่าใช้จ่ายเรียบร้อยแล้ว");
      utils.expenses.list.invalidate();
      utils.expenses.getById.invalidate({ id: expenseId! });
      navigate(`/expenses/${expenseId}`);
    },
    onError: (err) => {
      toast.error(err.message || "เกิดข้อผิดพลาดในการอัปเดต");
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = (data: any) => {
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

    if (isEdit) {
      updateMutation.mutate({ id: expenseId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isMutating = createMutation.isPending || updateMutation.isPending;

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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isMutating} className="gap-2 min-w-32">
              {isMutating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isEdit ? "บันทึกการแก้ไข" : "บันทึกค่าใช้จ่าย"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
