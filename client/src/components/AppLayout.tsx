import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Receipt,
  PlusCircle,
  Users,
  Building2,
  Tag,
  CreditCard,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Settings,
  Download,
  User,
} from "lucide-react";
import { toast } from "sonner";

const NAV_ITEMS = [
  {
    section: "หลัก",
    items: [
      { href: "/", label: "แดชบอร์ด", icon: LayoutDashboard, roles: ["user", "admin", "viewer"] },
      { href: "/expenses", label: "รายการค่าใช้จ่าย", icon: Receipt, roles: ["user", "admin", "viewer"] },
      { href: "/expenses/new", label: "บันทึกค่าใช้จ่าย", icon: PlusCircle, roles: ["user", "admin"] },
      { href: "/export", label: "ส่งออกข้อมูล", icon: Download, roles: ["user", "admin", "viewer"] },
    ],
  },
  {
    section: "ผู้ดูแลระบบ",
    adminOnly: true,
    items: [
      { href: "/admin/users", label: "จัดการผู้ใช้", icon: Users, roles: ["admin"] },
      { href: "/admin/master-data?tab=companies", label: "จัดการบริษัท", icon: Building2, roles: ["admin"] },
      { href: "/admin/master-data?tab=categories", label: "หมวดหมู่", icon: Tag, roles: ["admin"] },
      { href: "/admin/master-data?tab=paymentMethods", label: "วิธีชำระเงิน", icon: CreditCard, roles: ["admin"] },
    ],
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const utils = trpc.useUtils();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      window.location.href = "/login";
    },
    onError: () => {
      toast.error("เกิดข้อผิดพลาดในการออกจากระบบ");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const roleLabel = {
    admin: "ผู้ดูแลระบบ",
    user: "ผู้ใช้งาน",
    viewer: "ผู้ชม",
  }[user?.role ?? "user"];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center flex-shrink-0">
          <Receipt className="w-5 h-5 text-sidebar-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sidebar-foreground truncate">Expense Tracker</p>
          <p className="text-xs text-sidebar-foreground/50 truncate">ระบบบันทึกค่าใช้จ่าย</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV_ITEMS.map((section) => {
          const visibleItems = section.items.filter((item) =>
            item.roles.includes(user?.role ?? "user")
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.section}>
              <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 mb-2">
                {section.section}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const itemPath = item.href.split("?")[0];
                  const itemTab = new URLSearchParams(item.href.split("?")[1] ?? "").get("tab");
                  const currentTab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
                  const isActive = itemTab
                    ? location === itemPath && currentTab === itemTab
                    : location === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "sidebar-nav-item",
                        isActive && "active"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0 opacity-60" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User profile */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-sidebar-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.name || user?.username}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{roleLabel}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-1 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent justify-start gap-2"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar flex flex-col shadow-2xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Expense Tracker</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
