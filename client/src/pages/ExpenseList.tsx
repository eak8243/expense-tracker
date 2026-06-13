import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge, EXPENSE_TYPE_LABELS } from "@/components/StatusBadge";
import { BatchReimbursementModal } from "@/components/BatchReimbursementModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PlusCircle,
  Search,
  Filter,
  ChevronRight,
  Receipt,
  Building2,
  Calendar,
  X,
  Download,
  Banknote,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from "@/lib/utils";

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default function ExpenseList() {
  const { user } = useAuth();
  const isAdminOrViewer = user?.role === "admin" || user?.role === "viewer";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [expenseType, setExpenseType] = useState("all");
  const [companyId, setCompanyId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [paymentMethodId, setPaymentMethodId] = useState("all");
  const [iouNumber, setIouNumber] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Multi-select for batch reimbursement
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  const { data: masterData } = trpc.expenses.masterData.useQuery();
  const companies = masterData?.companies ?? [];
  const categories = masterData?.categories ?? [];
  const paymentMethods = masterData?.paymentMethods ?? [];
  const exportCsv = trpc.export.csv.useMutation();
  const exportExcel = trpc.export.excel.useMutation();

  const { data: expensesData, isLoading } = trpc.expenses.list.useQuery({
    keyword: search || undefined,
    status: status !== "all" ? status : undefined,
    expenseType: expenseType !== "all" ? expenseType : undefined,
    companyId: companyId !== "all" ? parseInt(companyId) : undefined,
    categoryId: categoryId !== "all" ? parseInt(categoryId) : undefined,
    paymentMethodId: paymentMethodId !== "all" ? parseInt(paymentMethodId) : undefined,
    iouNumber: iouNumber || undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    amountMin: amountMin ? parseFloat(amountMin) : undefined,
    amountMax: amountMax ? parseFloat(amountMax) : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const expenses = expensesData?.data ?? [];
  const total = expensesData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const hasFilters = status !== "all" || expenseType !== "all" || companyId !== "all" || search ||
    categoryId !== "all" || paymentMethodId !== "all" || iouNumber || dateFrom || dateTo || amountMin || amountMax;

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setExpenseType("all");
    setCompanyId("all");
    setCategoryId("all");
    setPaymentMethodId("all");
    setIouNumber("");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setPage(1);
  };

  // Only claimed expenses can be batch-reimbursed
  const claimedExpenses = expenses.filter((e: any) => e.status === "claimed");
  const selectedExpenses = expenses.filter((e: any) => selectedIds.has(e.id));

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllClaimed = () => {
    setSelectedIds(new Set(claimedExpenses.map((e: any) => e.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleExport = async () => {
    try {
      const result = await exportCsv.mutateAsync({
        status: status !== "all" ? status : undefined,
        expenseType: expenseType !== "all" ? expenseType : undefined,
        companyId: companyId !== "all" ? parseInt(companyId) : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      });
      const blob = new Blob([Buffer.from(result.content, 'base64')], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export CSV สำเร็จ');
    } catch {
      toast.error('ไม่สามารถ Export ข้อมูลได้');
    }
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportExcel.mutateAsync({
        status: status !== "all" ? status : undefined,
        expenseType: expenseType !== "all" ? expenseType : undefined,
        companyId: companyId !== "all" ? parseInt(companyId) : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      });
      const byteChars = atob(result.content);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export Excel สำเร็จ');
    } catch {
      toast.error('ไม่สามารถ Export Excel ได้');
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">รายการค่าใช้จ่าย</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {total > 0 ? `พบ ${total} รายการ` : "ยังไม่มีรายการ"}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
            {user?.role !== "viewer" && (
              <Link href="/expenses/new">
                <Button className="gap-2 hidden sm:flex">
                  <PlusCircle className="w-4 h-4" />
                  บันทึกใหม่
                </Button>
              </Link>
            )}
            {/* Batch select toggle — only for non-viewer */}
            {user?.role !== "viewer" && (
              <Button
                variant={selectMode ? "default" : "outline"}
                className="gap-2"
                onClick={toggleSelectMode}
                title="เลือกหลายรายการเพื่อเบิกรวม"
              >
                <CheckSquare className="w-4 h-4" />
                <span className="hidden sm:inline">{selectMode ? "ยกเลิกเลือก" : "เลือกเบิกรวม"}</span>
              </Button>
            )}
            <Button variant="outline" size="icon" className="sm:hidden" onClick={handleExport} disabled={exportCsv.isPending}>
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="gap-2 hidden sm:flex" onClick={handleExport} disabled={exportCsv.isPending}>
              <Download className="w-4 h-4" />
              CSV
            </Button>
            <Button variant="outline" className="gap-2 hidden sm:flex" onClick={handleExportExcel} disabled={exportExcel.isPending}>
              <Download className="w-4 h-4" />
              Excel
            </Button>
          </div>
        </div>

        {/* Batch action bar */}
        {selectMode && (
          <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <span className="text-sm font-medium text-emerald-400">
              เลือกแล้ว {selectedIds.size} รายการ
              {selectedIds.size > 0 && (
                <span className="text-muted-foreground ml-1">
                  (รวม ฿{formatAmount(
                    selectedExpenses.reduce((s: number, e: any) => s + parseFloat(e.amount ?? "0"), 0)
                  )})
                </span>
              )}
            </span>
            <div className="flex gap-2 ml-auto">
              {claimedExpenses.length > 0 && (
                <Button variant="outline" size="sm" onClick={selectAllClaimed} className="text-xs">
                  เลือกทั้งหมดที่ทำเบิกแล้ว ({claimedExpenses.length})
                </Button>
              )}
              {selectedIds.size > 0 && (
                <>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs">
                    ล้าง
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs"
                    onClick={() => {
                      // Validate all selected are claimed
                      const nonClaimed = selectedExpenses.filter((e: any) => e.status !== "claimed");
                      if (nonClaimed.length > 0) {
                        toast.error(`รายการ ${nonClaimed.map((e: any) => e.expenseNo).join(", ")} ต้องอยู่ในสถานะ "ทำเบิกแล้ว" ก่อนเบิกรวม`);
                        return;
                      }
                      setBatchModalOpen(true);
                    }}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    เบิกรวม {selectedIds.size} รายการ
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อรายการ, เลขที่, IOU..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Button
              variant="outline"
              className={`gap-2 ${showFilters ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4" />
              ตัวกรอง
              {hasFilters && <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 text-xs flex items-center justify-center">!</Badge>}
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-xl border">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะ</label>
                <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="draft">ร่าง</SelectItem>
                    <SelectItem value="claimed">ทำเบิกแล้ว</SelectItem>
                    <SelectItem value="reimbursed">ได้เงินแล้ว</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ประเภท</label>
                <Select value={expenseType} onValueChange={(v) => { setExpenseType(v); setPage(1); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="normal_expense">ค่าใช้จ่ายทั่วไป</SelectItem>
                    <SelectItem value="iou_advance">เงินทดรองจ่าย</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">บริษัท</label>
                <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setPage(1); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {companies.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">หมวดหมู่</label>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.categoryName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">วิธีชำระ</label>
                <Select value={paymentMethodId} onValueChange={(v) => { setPaymentMethodId(v); setPage(1); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    {paymentMethods.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.methodName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">เลข IOU</label>
                <Input
                  className="h-9"
                  placeholder="ค้นหาเลข IOU..."
                  value={iouNumber}
                  onChange={(e) => { setIouNumber(e.target.value); setPage(1); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่เริ่ม</label>
                <Input
                  className="h-9"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่สิ้นสุด</label>
                <Input
                  className="h-9"
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">จำนวนเงินต่ำสุด</label>
                <Input
                  className="h-9"
                  type="number"
                  placeholder="0"
                  value={amountMin}
                  onChange={(e) => { setAmountMin(e.target.value); setPage(1); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">จำนวนเงินสูงสุด</label>
                <Input
                  className="h-9"
                  type="number"
                  placeholder="ไม่จำกัด"
                  value={amountMax}
                  onChange={(e) => { setAmountMax(e.target.value); setPage(1); }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Expense List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : expenses.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Receipt className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">ไม่พบรายการค่าใช้จ่าย</p>
              {hasFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2 text-sm">
                  ล้างตัวกรองทั้งหมด
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense: any) => {
              const isSelected = selectedIds.has(expense.id);
              const isClaimed = expense.status === "claimed";
              const canSelect = selectMode && isClaimed;

              const cardContent = (
                <div
                  className={`group flex items-center gap-3 sm:gap-4 p-4 bg-card border rounded-xl transition-all cursor-pointer
                    ${selectMode
                      ? isSelected
                        ? "border-emerald-500 bg-emerald-500/5 shadow-sm"
                        : isClaimed
                          ? "hover:border-emerald-500/50 hover:bg-emerald-500/5"
                          : "opacity-60"
                      : "hover:shadow-md hover:border-primary/30"
                    }`}
                  onClick={canSelect ? (e) => toggleSelect(expense.id, e) : undefined}
                >
                  {/* Checkbox (select mode) */}
                  {selectMode && (
                    <div className="flex-shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                      <Checkbox
                        checked={isSelected}
                        disabled={!isClaimed}
                        onCheckedChange={() => {
                          if (!isClaimed) return;
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(expense.id)) next.delete(expense.id);
                            else next.add(expense.id);
                            return next;
                          });
                        }}
                        className="h-5 w-5"
                      />
                    </div>
                  )}

                  {/* Type indicator */}
                  <div className={`w-1.5 h-12 rounded-full flex-shrink-0 ${
                    expense.expenseType === "iou_advance" ? "bg-orange-400" : "bg-teal-500"
                  }`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-medium text-sm truncate">{expense.itemName}</p>
                      <StatusBadge status={expense.status} showIcon={false} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="font-mono">{expense.expenseNo}</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {(expense as any).companyName ?? "—"}
                      </span>
                      <span className="hidden sm:flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(expense.expenseDate)}
                      </span>
                      {isAdminOrViewer && (expense as any).userName && (
                        <span className="text-primary/70 hidden sm:inline">{(expense as any).userName}</span>
                      )}
                    </div>
                    {expense.expenseType === "iou_advance" && expense.iouNumber && (
                      <p className="text-xs text-orange-600 mt-0.5">IOU: {expense.iouNumber}</p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    {(expense as any).foreignCurrency === "USD" ? (
                      <>
                        <p className="font-bold tabular-nums text-base text-blue-700">
                          ${formatAmount((expense as any).foreignAmount)}
                          <span className="text-xs font-normal ml-1 text-blue-500">USD</span>
                        </p>
                        {(!expense.amount || parseFloat(String(expense.amount)) === 0) ? (
                          <p className="text-xs text-amber-500 font-medium">รอยอด THB</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">฿{formatAmount(expense.amount)}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="font-bold tabular-nums text-base">฿{formatAmount(expense.amount)}</p>
                        <p className="text-xs text-muted-foreground">{EXPENSE_TYPE_LABELS[expense.expenseType] ?? expense.expenseType}</p>
                      </>
                    )}
                  </div>

                  {!selectMode && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0" />
                  )}
                </div>
              );

              return selectMode ? (
                <div key={expense.id}>{cardContent}</div>
              ) : (
                <Link key={expense.id} href={`/expenses/${expense.id}`}>
                  {cardContent}
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              ก่อนหน้า
            </Button>
            <span className="text-sm text-muted-foreground">
              หน้า {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              ถัดไป
            </Button>
          </div>
        )}
      </div>

      {/* Batch Reimbursement Modal */}
      <BatchReimbursementModal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        selectedExpenses={selectedExpenses.map((e: any) => ({
          id: e.id,
          expenseNo: e.expenseNo,
          itemName: e.itemName,
          amount: e.amount,
          currency: e.currency ?? "THB",
          companyName: e.companyName,
        }))}
        onSuccess={() => {
          setSelectMode(false);
          setSelectedIds(new Set());
        }}
      />
    </AppLayout>
  );
}
