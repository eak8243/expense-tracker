import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, Tag, CreditCard, Plus, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";

const VALID_TABS = ["companies", "categories", "paymentMethods"] as const;
type TabValue = typeof VALID_TABS[number];

function getTabFromSearch(): TabValue {
  if (typeof window === "undefined") return "companies";
  const t = new URLSearchParams(window.location.search).get("tab");
  return (VALID_TABS as readonly string[]).includes(t ?? "") ? (t as TabValue) : "companies";
}

export default function AdminMasterData() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromSearch);

  // Sync tab when URL changes (e.g. clicking sidebar links)
  useEffect(() => {
    const handler = () => setActiveTab(getTabFromSearch());
    window.addEventListener("popstate", handler);
    // Also run on mount in case navigation happened without popstate
    setActiveTab(getTabFromSearch());
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const handleTabChange = (val: string) => {
    setActiveTab(val as TabValue);
    navigate(`/admin/master-data?tab=${val}`);
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Master Data</h1>
          <p className="text-muted-foreground text-sm mt-0.5">จัดการข้อมูลพื้นฐานของระบบ</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="companies" className="gap-2">
              <Building2 className="w-4 h-4" />
              บริษัท
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <Tag className="w-4 h-4" />
              หมวดหมู่
            </TabsTrigger>
            <TabsTrigger value="paymentMethods" className="gap-2">
              <CreditCard className="w-4 h-4" />
              วิธีชำระเงิน
            </TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="mt-4">
            <CompaniesTab />
          </TabsContent>
          <TabsContent value="categories" className="mt-4">
            <CategoriesTab />
          </TabsContent>
          <TabsContent value="paymentMethods" className="mt-4">
            <PaymentMethodsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ─── Companies ─────────────────────────────────────────────────────────────────

function CompaniesTab() {
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const { data, isLoading, refetch } = trpc.admin.listCompanies.useQuery();

  const createMutation = trpc.admin.createCompany.useMutation({
    onSuccess: () => { toast.success("สร้างบริษัทเรียบร้อย"); setOpen(false); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMutation = trpc.admin.updateCompany.useMutation({
    onSuccess: () => { toast.success("อัปเดตบริษัทเรียบร้อย"); setEditItem(null); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">บริษัท ({data?.length ?? 0})</CardTitle>
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              เพิ่มบริษัท
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="divide-y">
              {data?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.companyName}</p>
                    {item.taxId && <p className="text-xs text-muted-foreground">เลขภาษี: {item.taxId}</p>}
                  </div>
                  <Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">
                    {item.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItem(item)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CompanyDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(d: any) => createMutation.mutate(d)}
        isPending={createMutation.isPending}
        mode="create"
      />
      {editItem && (
        <CompanyDialog
          open={!!editItem}
          onClose={() => setEditItem(null)}
          onSubmit={(d: any) => updateMutation.mutate({ id: editItem.id, ...d })}
          isPending={updateMutation.isPending}
          mode="edit"
          defaultValues={editItem}
        />
      )}
    </>
  );
}

function CompanyDialog({ open, onClose, onSubmit, isPending, mode, defaultValues }: any) {
  const [form, setForm] = useState({
    companyName: defaultValues?.companyName ?? "",
    taxId: defaultValues?.taxId ?? "",
    address: defaultValues?.address ?? "",
    isActive: defaultValues?.isActive ?? true,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "เพิ่มบริษัท" : "แก้ไขบริษัท"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label>ชื่อบริษัท <span className="text-destructive">*</span></Label>
            <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>เลขภาษี</Label>
            <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>ที่อยู่</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          {mode === "edit" && (
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>เปิดใช้งาน</Label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Categories ────────────────────────────────────────────────────────────────

function CategoriesTab() {
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const { data, isLoading, refetch } = trpc.admin.listCategories.useQuery();

  const createMutation = trpc.admin.createCategory.useMutation({
    onSuccess: () => { toast.success("สร้างหมวดหมู่เรียบร้อย"); setOpen(false); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMutation = trpc.admin.updateCategory.useMutation({
    onSuccess: () => { toast.success("อัปเดตหมวดหมู่เรียบร้อย"); setEditItem(null); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">หมวดหมู่ ({data?.length ?? 0})</CardTitle>
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              เพิ่มหมวดหมู่
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="divide-y">
              {data?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 px-6 py-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: item.colorCode ? `${item.colorCode}20` : undefined }}
                  >
                    <Tag className="w-4 h-4" style={{ color: item.colorCode ?? undefined }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.categoryName}</p>
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  </div>
                  <Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">
                    {item.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItem(item)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CategoryDialog open={open} onClose={() => setOpen(false)} onSubmit={(d: any) => createMutation.mutate(d)} isPending={createMutation.isPending} mode="create" />
      {editItem && (
        <CategoryDialog open={!!editItem} onClose={() => setEditItem(null)} onSubmit={(d: any) => updateMutation.mutate({ id: editItem.id, ...d })} isPending={updateMutation.isPending} mode="edit" defaultValues={editItem} />
      )}
    </>
  );
}

function CategoryDialog({ open, onClose, onSubmit, isPending, mode, defaultValues }: any) {
  const [form, setForm] = useState({
    categoryName: defaultValues?.categoryName ?? "",
    description: defaultValues?.description ?? "",
    colorCode: defaultValues?.colorCode ?? "#6366f1",
    isActive: defaultValues?.isActive ?? true,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "เพิ่มหมวดหมู่" : "แก้ไขหมวดหมู่"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label>ชื่อหมวดหมู่ <span className="text-destructive">*</span></Label>
            <Input value={form.categoryName} onChange={(e) => setForm({ ...form, categoryName: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>คำอธิบาย</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>สี</Label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.colorCode} onChange={(e) => setForm({ ...form, colorCode: e.target.value })} className="w-10 h-10 rounded cursor-pointer border" />
              <Input value={form.colorCode} onChange={(e) => setForm({ ...form, colorCode: e.target.value })} className="font-mono" />
            </div>
          </div>
          {mode === "edit" && (
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>เปิดใช้งาน</Label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Methods ────────────────────────────────────────────────────────────

function PaymentMethodsTab() {
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const { data, isLoading, refetch } = trpc.admin.listPaymentMethods.useQuery();

  const createMutation = trpc.admin.createPaymentMethod.useMutation({
    onSuccess: () => { toast.success("สร้างวิธีชำระเงินเรียบร้อย"); setOpen(false); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMutation = trpc.admin.updatePaymentMethod.useMutation({
    onSuccess: () => { toast.success("อัปเดตวิธีชำระเงินเรียบร้อย"); setEditItem(null); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">วิธีชำระเงิน ({data?.length ?? 0})</CardTitle>
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              เพิ่มวิธีชำระเงิน
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="divide-y">
              {data?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 px-6 py-3">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.methodName}</p>
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  </div>
                  <Badge variant={item.isActive ? "default" : "secondary"} className="text-xs">
                    {item.isActive ? "ใช้งาน" : "ปิดใช้งาน"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItem(item)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentMethodDialog open={open} onClose={() => setOpen(false)} onSubmit={(d: any) => createMutation.mutate(d)} isPending={createMutation.isPending} mode="create" />
      {editItem && (
        <PaymentMethodDialog open={!!editItem} onClose={() => setEditItem(null)} onSubmit={(d: any) => updateMutation.mutate({ id: editItem.id, ...d })} isPending={updateMutation.isPending} mode="edit" defaultValues={editItem} />
      )}
    </>
  );
}

function PaymentMethodDialog({ open, onClose, onSubmit, isPending, mode, defaultValues }: any) {
  const [form, setForm] = useState({
    methodName: defaultValues?.methodName ?? "",
    description: defaultValues?.description ?? "",
    isActive: defaultValues?.isActive ?? true,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "เพิ่มวิธีชำระเงิน" : "แก้ไขวิธีชำระเงิน"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label>ชื่อวิธีชำระเงิน <span className="text-destructive">*</span></Label>
            <Input value={form.methodName} onChange={(e) => setForm({ ...form, methodName: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>คำอธิบาย</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          {mode === "edit" && (
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>เปิดใช้งาน</Label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
