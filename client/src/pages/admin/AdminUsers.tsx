import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Edit, Loader2, Shield, Eye, User } from "lucide-react";
import { toast } from "sonner";

const ROLE_CONFIG = {
  admin: { label: "ผู้ดูแลระบบ", icon: Shield, className: "bg-red-100 text-red-700" },
  user: { label: "ผู้ใช้งาน", icon: User, className: "bg-blue-100 text-blue-700" },
  viewer: { label: "ผู้ชม", icon: Eye, className: "bg-gray-100 text-gray-700" },
};

export default function AdminUsers() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);

  const { data: users, isLoading, refetch } = trpc.admin.listUsers.useQuery();

  const createMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => { toast.success("สร้างผู้ใช้เรียบร้อย"); setCreateOpen(false); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = trpc.admin.updateUser.useMutation({
    onSuccess: () => { toast.success("อัปเดตผู้ใช้เรียบร้อย"); setEditUser(null); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              จัดการผู้ใช้
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">{users?.length ?? 0} ผู้ใช้ทั้งหมด</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            เพิ่มผู้ใช้
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {users?.map((u: any) => {
                  const roleConf = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG];
                  return (
                    <div key={u.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {(u.name || u.username || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{u.name || u.username}</p>
                        <p className="text-xs text-muted-foreground">@{u.username} {u.email && `· ${u.email}`}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${roleConf?.className}`}>
                          {roleConf?.label}
                        </span>
                        <Badge variant={u.isActive ? "default" : "secondary"} className="text-xs">
                          {u.isActive ? "ใช้งาน" : "ระงับ"}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditUser(u)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Dialog */}
      <UserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(data: any) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        mode="create"
      />

      {/* Edit Dialog */}
      {editUser && (
        <UserDialog
          open={!!editUser}
          onClose={() => setEditUser(null)}
          onSubmit={(data: any) => updateMutation.mutate({ id: editUser.id, ...data })}
          isPending={updateMutation.isPending}
          mode="edit"
          defaultValues={editUser}
        />
      )}
    </AppLayout>
  );
}

function UserDialog({ open, onClose, onSubmit, isPending, mode, defaultValues }: any) {
  const [form, setForm] = useState({
    username: defaultValues?.username ?? "",
    name: defaultValues?.name ?? "",
    email: defaultValues?.email ?? "",
    password: "",
    role: defaultValues?.role ?? "user",
    isActive: defaultValues?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { ...form };
    if (mode === "edit" && !data.password) delete data.password;
    if (mode === "edit") delete data.username;
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "เพิ่มผู้ใช้ใหม่" : "แก้ไขผู้ใช้"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "create" && (
            <div className="space-y-1.5">
              <Label>ชื่อผู้ใช้ <span className="text-destructive">*</span></Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>ชื่อ-นามสกุล <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>อีเมล</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{mode === "create" ? "รหัสผ่าน *" : "รหัสผ่านใหม่ (ถ้าต้องการเปลี่ยน)"}</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={mode === "create"}
              minLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <Label>บทบาท</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">ผู้ใช้งาน</SelectItem>
                <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
                <SelectItem value="viewer">ผู้ชม</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "edit" && (
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label>เปิดใช้งาน</Label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "create" ? "สร้าง" : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
