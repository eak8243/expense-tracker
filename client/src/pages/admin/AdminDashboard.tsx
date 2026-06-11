import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppLayout } from "@/components/AppLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { Users, TrendingUp, Clock, CheckCircle2, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";

function formatAmount(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "0";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#8b5cf6"];

export default function AdminDashboard() {
  const [year, setYear] = useState(new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const { data: rawData, isLoading } = trpc.dashboard.adminSummary.useQuery();
  const { data: monthlyData } = trpc.dashboard.adminMonthlyTrend.useQuery({ months: 12 });
  const summary = rawData as any;

  const handleExport = async () => {
    try {
      const result = await fetch(`/api/export/expenses?format=csv`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!result.ok) throw new Error("Export failed");
      const blob = await result.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expenses-${year}.csv`;
      a.click();
    } catch {
      toast.error("ไม่สามารถ Export ข้อมูลได้");
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">ภาพรวมค่าใช้จ่ายทั้งระบบ</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                icon={Users}
                label="ผู้ใช้งานทั้งหมด"
                value={String(summary?.byUser?.length ?? 0)}
                unit="คน"
                color="blue"
              />
              <SummaryCard
                icon={TrendingUp}
                label="ยอดรวมทั้งหมด"
                value={formatAmount(summary?.summary?.totalAmount)}
                unit="บาท"
                color="purple"
              />
              <SummaryCard
                icon={Clock}
                label="รอเบิก (Draft)"
                value={formatAmount(summary?.summary?.draftAmount)}
                unit="บาท"
                color="yellow"
              />
              <SummaryCard
                icon={CheckCircle2}
                label="ได้เงินแล้ว"
                value={formatAmount(summary?.summary?.reimbursedAmount)}
                unit="บาท"
                color="green"
              />
            </div>

            {/* Outstanding */}
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">ยอดค้างเบิกทั้งระบบ</p>
                    <p className="text-xs text-amber-600">รายการที่ยังไม่ได้รับเงินคืน (Draft + Claimed)</p>
                  </div>
                  <p className="text-2xl font-bold text-amber-700 tabular-nums">
                    ฿{formatAmount(
                      (parseFloat(summary?.summary?.draftAmount || "0") +
                        parseFloat(summary?.summary?.claimedAmount || "0"))
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Charts Row */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Monthly Trend */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">แนวโน้มรายเดือน {year}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart                     data={(monthlyData ?? []).map((m: any) => ({ month: `เดือน ${m.month}`, amount: parseFloat(m.totalAmount || '0') }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip
                        formatter={(v: any) => [`฿${formatAmount(v)}`, "ยอดรวม"]}
                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* By Category */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">แบ่งตามหมวดหมู่</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={(summary?.byCategory ?? []).map((c: any) => ({ ...c, amount: parseFloat(c.totalAmount || '0'), category: c.categoryName || '(ไม่ระบุ)' }))}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ category, percent }: any) =>
                          `${category} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {(summary?.byCategory ?? []).map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`฿${formatAmount(v)}`, ""]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* By Company */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">แบ่งตามบริษัท</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(summary?.byCompany ?? []).map((item: any, i: number) => {
                    const max = Math.max(...(summary?.byCompany ?? []).map((c: any) => parseFloat(c.totalAmount) || 0));
                    const pct = max > 0 ? ((parseFloat(item.totalAmount) || 0) / max) * 100 : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.companyName ?? '(ไม่ระบุ)'}</span>
                          <span className="tabular-nums text-muted-foreground">฿{formatAmount(item.totalAmount)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent Expenses */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">รายการล่าสุดทั้งระบบ</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {(summary?.recent ?? []).map((e: any) => (
                    <div key={e.id} className="flex items-center gap-4 px-6 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{e.itemName}</p>
                        <p className="text-xs text-muted-foreground">{e.userName} · {e.companyName}</p>
                      </div>
                      <StatusBadge status={e.status} />
                      <p className="text-sm font-semibold tabular-nums">฿{formatAmount(e.amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({ icon: Icon, label, value, unit, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit: string;
  color: "blue" | "purple" | "yellow" | "green";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    yellow: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
  };

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-0.5">{value}</p>
        <p className="text-xs text-muted-foreground">{unit}</p>
      </CardContent>
    </Card>
  );
}
