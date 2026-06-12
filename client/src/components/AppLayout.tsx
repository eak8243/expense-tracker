import { useState, useEffect } from "react";
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
  Download,
  User,
  HardDrive,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";

const NAV_ITEMS = [
  {
    section: "หลัก",
    items: [
      { href: "/", label: "แดชบอร์ด", icon: LayoutDashboard, roles: ["user", "admin", "viewer"] },
      { href: "/expenses", label: "รายการค่าใช้จ่าย", icon: Receipt, roles: ["user", "admin", "viewer"] },
      { href: "/expenses/new", label: "บันทึกค่าใช้จ่าย", icon: PlusCircle, roles: ["user", "admin"] },
      { href: "/batches", label: "กลุ่มเบิกรวม", icon: Banknote, roles: ["user", "admin", "viewer"] },
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
      { href: "/admin/storage-settings", label: "ตั้งค่า Storage", icon: HardDrive, roles: ["admin"] },
    ],
  },
];

// Bottom nav items (mobile only) — show the 4 most important
const BOTTOM_NAV_ITEMS = [
  { href: "/", label: "แดชบอร์ด", icon: LayoutDashboard, roles: ["user", "admin", "viewer"] },
  { href: "/expenses", label: "รายการ", icon: Receipt, roles: ["user", "admin", "viewer"] },
  { href: "/expenses/new", label: "บันทึก", icon: PlusCircle, roles: ["user", "admin"] },
  { href: "/export", label: "ส่งออก", icon: Download, roles: ["user", "admin", "viewer"] },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const utils = trpc.useUtils();

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

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

  function isNavActive(href: string) {
    const itemPath = href.split("?")[0];
    const itemTab = new URLSearchParams(href.split("?")[1] ?? "").get("tab");
    const currentTab = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null;
    return itemTab
      ? location === itemPath && currentTab === itemTab
      : location === href;
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary/20 border border-sidebar-primary/30 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-5 h-5 text-sidebar-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">Expense Tracker</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">ระบบบันทึกค่าใช้จ่าย</p>
          </div>
        </div>
        {/* Close button on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden flex-shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </Button>
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
                  const active = isNavActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn("sidebar-nav-item", active && "active")}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {active && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0 opacity-60" />}
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

  const visibleBottomItems = BOTTOM_NAV_ITEMS.filter((item) =>
    item.roles.includes(user?.role ?? "user")
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-all duration-300",
          sidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
            sidebarOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setSidebarOpen(false)}
        />
        {/* Drawer */}
        <aside
          className={cn(
            "absolute left-0 top-0 bottom-0 w-72 bg-sidebar flex flex-col shadow-2xl transition-transform duration-300 ease-out",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent />
        </aside>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="flex-shrink-0 -ml-2"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Receipt className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="font-semibold text-sm truncate">Expense Tracker</span>
          </div>
          {/* Quick add button on mobile header */}
          {user?.role !== "viewer" && (
            <Link href="/expenses/new">
              <Button size="icon" variant="ghost" className="flex-shrink-0 -mr-2">
                <PlusCircle className="w-5 h-5 text-primary" />
              </Button>
            </Link>
          )}
        </header>

        {/* Page content — add bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto pb-safe lg:pb-0" style={{ paddingBottom: visibleBottomItems.length > 0 ? 'calc(env(safe-area-inset-bottom) + 64px)' : undefined }}>
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-stretch"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {visibleBottomItems.map((item) => {
            const active = isNavActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors min-h-[56px]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
                  active ? "bg-primary/10 scale-110" : ""
                )}>
                  <Icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
                </div>
                <span className={cn("leading-none", active && "font-semibold")}>{item.label}</span>
              </Link>
            );
          })}
          {/* More menu for admin */}
          {user?.role === "admin" && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[56px]"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center">
                <Menu className="w-5 h-5" />
              </div>
              <span className="leading-none">เพิ่มเติม</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
