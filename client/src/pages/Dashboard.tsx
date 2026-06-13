import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Clock,
  FileCheck,
  CheckCircle2,
  PlusCircle,
  ArrowRight,
  Wallet,
  AlertCircle,
  Building2,
} from "lucide-react";
import { formatAmount } from "@/lib/utils";

const COLORS = ["#0d9488", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Dashboard() {
  const { user } = useAuth();
  const isAdminOrViewer = user?.role === "admin" || user?.role === "viewer";

  // ─── Company filter state ─────────────────────────────────────────────────
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(undefined);

  // ─── Fetch companies for dropdown ─────────────────────────────────────────
  const { data: companiesData } = trpc.dashboard.myCompanies.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  // ─── Dashboard data queries ───────────────────────────────────────────────
  const { data: myData, isLoading: myLoading } = trpc.dashboard.mySummary.useQuery(
    { companyId: selectedCompanyId },
    { enabled: !isAdminOrViewer }
  );
  const { data: adminData, isLoading: adminLoading } = trpc.dashboard.adminSummary.useQuery(
    { companyId: selectedCompanyId },
    { enabled: isAdminOrViewer }
  );
  const { data: trendData, isLoading: trendLoading } = isAdminOrViewer
    ? trpc.dashboard.adminMonthlyTrend.useQuery({ months: 12, companyId: selectedCompanyId })
    : trpc.dashboard.myMonthlyTrend.useQuery({ months: 12, companyId: selectedCompanyId });

  const data = isAdminOrViewer ? adminData : myData;
  const isLoading = isAdminOrViewer ? adminLoading : myLoading;

  // ─── Derived chart data ───────────────────────────────────────────────────
  const hasPendingUsd = useMemo(() => {
    const s = data?.summary as any;
    return s && parseFloat(s.pendingUsdAmount ?? "0") > 0;
  }, [data]);

  const summaryCards = useMemo(() => {
    if (!data?.summary) return [];
    const s = data.summary as any;
    const pendingUsdCount = Number(s.pendingUsdCount ?? 0);
    const draftPendingUsdCount = Number(s.draftPendingUsdCount ?? 0);
    const usdRate = (data as any).usdExchangeRate ?? 36;
    const estimatedTotal = (data as any).estimatedTotal ?? parseFloat(s.totalAmount ?? "0");
    const estimatedDraftTotal = (data as any).estimatedDraftTotal ?? parseFloat(s.draftAmount ?? "0");
    const showEstimated = pendingUsdCount > 0;
    const showDraftEstimated = draftPendingUsdCount > 0;
    return [
      {
        title: showEstimated ? "ยอดรวม (ประมาณการ)" : "ยอดรวมทั้งหมด",
        value: formatAmount(showEstimated ? estimatedTotal : s.totalAmount),
        subtitle: showEstimated ? `รวม USD ${pendingUsdCount} รายการ (อัตรา ฿${usdRate.toFixed(2)}/USD)` : undefined,
        icon: Wallet,
        color: showEstimated ? "text-orange-700" : "text-slate-700",
        bg: showEstimated ? "bg-orange-100" : "bg-slate-100",
      },
      {
        title: showDraftEstimated ? "รอทำเบิก (ร่าง) (ประมาณการ)" : "รอทำเบิก (ร่าง)",
        value: formatAmount(showDraftEstimated ? estimatedDraftTotal : s.draftAmount),
        count: Number(s.draftCount ?? 0),
        subtitle: showDraftEstimated ? `รวม USD ${draftPendingUsdCount} รายการ (อัตรา ฿${usdRate.toFixed(2)}/USD)` : undefined,
        icon: Clock,
        color: showDraftEstimated ? "text-orange-700" : "text-amber-700",
        bg: showDraftEstimated ? "bg-orange-100" : "bg-amber-100",
      },
      {
        title: "ทำเบิกแล้ว",
        value: formatAmount(s.claimedAmount),
        count: Number(s.claimedCount ?? 0),
        icon: FileCheck,
        color: "text-blue-700",
        bg: "bg-blue-100",
      },
      {
        title: "ได้เงินแล้ว",
        value: formatAmount(s.reimbursedAmount),
        count: Number(s.reimbursedCount ?? 0),
        icon: CheckCircle2,
        color: "text-emerald-700",
        bg: "bg-emerald-100",
      },
    ];
  }, [data]);

  const trendChartData = useMemo(() => {
    if (!trendData) return [];
    return trendData.map((row) => ({
      month: row.month,
      amount: parseFloat(row.totalAmount ?? "0"),
      count: Number(row.count ?? 0),
    }));
  }, [trendData]);

  const categoryChartData = useMemo(() => {
    if (!data?.byCategory) return [];
    return data.byCategory.slice(0, 6).map((row) => ({
      name: row.categoryName ?? "ไม่ระบุ",
      value: parseFloat(row.totalAmount ?? "0"),
    }));
  }, [data]);

  // ─── Selected company name for display ───────────────────────────────────
  const selectedCompanyName = useMemo(() => {
    if (!selectedCompanyId || !companiesData) return null;
    return companiesData.find((c: any) => c.id === selectedCompanyId)?.companyName ?? null;
  }, [selectedCompanyId, companiesData]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {isAdminOrViewer ? "แดชบอร์ดภาพรวม" : "แดชบอร์ดของฉัน"}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              สวัสดี คุณ{user?.name || user?.username} — ยินดีต้อนรับกลับมา
              {selectedCompanyName && (
                <span className="ml-1 text-primary font-medium">· {selectedCompanyName}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Company Filter Dropdown */}
            {companiesData && companiesData.length > 0 && (
              <Select
                value={selectedCompanyId ? String(selectedCompanyId) : "all"}
                onValueChange={(val) =>
                  setSelectedCompanyId(val === "all" ? undefined : Number(val))
                }
              >
                <SelectTrigger className="w-36 sm:w-44 h-9 text-sm gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <SelectValue placeholder="ทุกบริษัท" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกบริษัท</SelectItem>
                  {companiesData.map((company: any) => (
                    <SelectItem key={company.id} value={String(company.id)}>
                      {company.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {user?.role !== "viewer" && (
              <Link href="/expenses/new">
                <Button className="gap-2 h-9 hidden sm:flex">
                  <PlusCircle className="w-4 h-4" />
                  บันทึกค่าใช้จ่าย
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${card.color}`} />
                      </div>
                      {card.count !== undefined && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {card.count} รายการ
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{card.title}</p>
                     <p className="text-xl font-bold tabular-nums text-foreground">
                       ฿{card.value}
                     </p>
                     {(card as any).subtitle && (
                       <p className="text-xs text-orange-600 mt-1">{(card as any).subtitle}</p>
                     )}
                   </CardContent>
                 </Card>
              );
            })}
          </div>
        )}

        {/* IOU Summary */}
        {data?.summary && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                สรุปเงินทดรองจ่าย (IOU)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">ยอดรวม IOU</p>
                  <p className="text-lg font-bold tabular-nums">฿{formatAmount(data.summary.iouTotalAmount)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50">
                  <p className="text-xs text-blue-600 mb-1">ทำเบิกแล้ว</p>
                  <p className="text-lg font-bold tabular-nums text-blue-700">฿{formatAmount((data.summary as any).iouClaimedAmount)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-emerald-50">
                  <p className="text-xs text-emerald-600 mb-1">ได้เงินแล้ว</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-700">฿{formatAmount((data.summary as any).iouReimbursedAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Monthly Trend */}
          <Card className="lg:col-span-2 border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  แนวโน้มรายเดือน
                  {selectedCompanyName && (
                    <span className="text-xs font-normal text-muted-foreground">
                      — {selectedCompanyName}
                    </span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <Skeleton className="h-48" />
              ) : trendChartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  ยังไม่มีข้อมูล
                </div>
              ) : (
                <div className="overflow-x-auto">
                <ResponsiveContainer width="100%" minWidth={280} height={200}>
                  <BarChart data={trendChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => [`฿${formatAmount(value)}`, "ยอดรวม"]}
                      labelStyle={{ fontFamily: "Sarabun" }}
                    />
                    <Bar dataKey="amount" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ตามหมวดหมู่</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : categoryChartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  ยังไม่มีข้อมูล
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {categoryChartData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`฿${formatAmount(value)}`, ""]} />
                    <Legend
                      formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Expenses */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">รายการล่าสุด</CardTitle>
              <Link href="/expenses">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                  ดูทั้งหมด <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : !data?.recent || data.recent.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                ยังไม่มีรายการค่าใช้จ่าย
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.recent.map((expense) => (
                  <Link key={expense.id} href={`/expenses/${expense.id}`}>
                    <div className="flex items-center gap-3 px-4 sm:px-6 py-3.5 hover:bg-muted/50 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{expense.itemName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {expense.expenseNo} · {expense.companyName}
                          {isAdminOrViewer && expense.userName && ` · ${expense.userName}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold tabular-nums">
                          ฿{formatAmount(expense.amount)}
                        </p>
                        <StatusBadge status={expense.status} showIcon={false} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
