import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Wallet,
  History,
  BarChart3,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { initials } from "@/lib/format";

const nav = [
  { to: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/groups", label: "Nhóm", icon: Users },
  { to: "/payments", label: "Thanh toán", icon: Wallet },
  { to: "/history", label: "Lịch sử", icon: History },
  { to: "/stats", label: "Thống kê", icon: BarChart3 },
];

export function AppShell() {
  const { user } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? ""));
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
        <Link to="/dashboard" className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">
            ₫
          </div>
          <div>
            <div className="font-semibold text-sidebar-foreground">ChiaTien</div>
            <div className="text-xs text-muted-foreground">Quản lý chi tiêu nhóm</div>
          </div>
        </Link>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
              activeOptions={{ exact: false }}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3 space-y-1">
          <Link
            to="/profile"
            className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors"
          >
            <div className="size-8 rounded-full bg-primary-soft text-primary grid place-items-center text-xs font-semibold">
              {initials(displayName || user?.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-sidebar-foreground">
                {displayName || "Tài khoản"}
              </div>
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
            <UserIcon className="size-4 text-muted-foreground" />
          </Link>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> Đăng xuất
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
