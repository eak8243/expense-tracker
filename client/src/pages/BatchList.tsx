import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Banknote, Calendar, ChevronRight, FileText, Receipt } from "lucide-react";
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

export default function BatchList() {
  const { user } = useAuth();
  const isAdminOrViewer = user?.role === "admin" || user?.role === "viewer";

  const { data: batches, isLoading } = trpc.batches.list.useQuery(
    { all: isAdminOrViewer ? true : undefined }
  );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Banknote className="h-6 w-6 text-emerald-400" />
              กลุ่มเบิกรวม
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {batches ? `${batches.length} กลุ่ม` : "กำลังโหลด..."}
            </p>
          </div>
          <Link href="/expenses">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Receipt className="h-4 w-4" />
              ไปรายการค่าใช้จ่าย
            </Button>
          </Link>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : !batches || batches.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Banknote className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">ยังไม่มีกลุ่มเบิกรวม</p>
              <p className="text-sm text-muted-foreground mt-1">
                ไปที่รายการค่าใช้จ่าย เลือกรายการที่ต้องการ แล้วกด "เลือกเบิกรวม"
              </p>
              <Link href="/expenses">
                <Button variant="link" className="mt-2">ไปรายการค่าใช้จ่าย</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {batches.map((batch: any) => (
              <Link key={batch.id} href={`/batches/${batch.id}`}>
                <div className="group flex items-center gap-4 p-4 bg-card border rounded-xl hover:shadow-md hover:border-emerald-500/30 transition-all cursor-pointer">
                  {/* Left accent */}
                  <div className="w-1.5 h-12 rounded-full bg-emerald-500 flex-shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{batch.batchNo}</span>
                      <Badge
                        variant="outline"
                        className="text-xs border-emerald-500/30 text-emerald-400"
                      >
                        {batch.expenseCount} รายการ
                      </Badge>
                      {batch.proofFileName && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <FileText className="h-3 w-3" />
                          มีหลักฐาน
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        รับเงิน {formatDate(batch.reimbursedAt)}
                      </span>
                      {isAdminOrViewer && batch.createdByName && (
                        <span className="text-primary/70">{batch.createdByName}</span>
                      )}
                      {batch.note && (
                        <span className="truncate max-w-[200px]">{batch.note}</span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold tabular-nums text-base text-emerald-400">
                      ฿{formatAmount(batch.totalAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">ยอดรวม</p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
