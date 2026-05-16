import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Users, Receipt, Wallet, ArrowRight } from "lucide-react";
import { formatVND } from "@/lib/format";
import { computeBalances } from "@/lib/debt-math";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();

  const { data: groups = [] } = useQuery({
    queryKey: ["dashboard-groups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: m } = await supabase
        .from("group_members")
        .select("group_id, groups(id, name, description)")
        .eq("user_id", user!.id);
      return (m ?? []).map((r) => r.groups).filter(Boolean) as Array<{
        id: string;
        name: string;
        description: string | null;
      }>;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id, groups.map((g) => g.id).join(",")],
    enabled: !!user && groups.length > 0,
    queryFn: async () => {
      const ids = groups.map((g) => g.id);
      const [members, bills, splits, payments, pending] = await Promise.all([
        supabase.from("group_members").select("group_id, user_id").in("group_id", ids),
        supabase.from("bills").select("id, group_id, total_amount, paid_by").in("group_id", ids),
        supabase.from("bill_splits").select("bill_id, user_id, amount"),
        supabase
          .from("payments")
          .select("group_id, from_user, to_user, amount, status")
          .in("group_id", ids),
        supabase
          .from("payments")
          .select("id")
          .eq("to_user", user!.id)
          .eq("status", "pending"),
      ]);

      let netForMe = 0;
      for (const g of ids) {
        const memberIds = (members.data ?? [])
          .filter((m) => m.group_id === g)
          .map((m) => m.user_id);
        const gBills = (bills.data ?? [])
          .filter((b) => b.group_id === g)
          .map((b) => ({
            id: b.id,
            total_amount: Number(b.total_amount),
            paid_by: b.paid_by,
            splits: (splits.data ?? [])
              .filter((s) => s.bill_id === b.id)
              .map((s) => ({ user_id: s.user_id, amount: Number(s.amount) })),
          }));
        const gPays = (payments.data ?? []).filter((p) => p.group_id === g);
        const bal = computeBalances(memberIds, gBills, gPays);
        netForMe += bal[user!.id] ?? 0;
      }
      return {
        billCount: bills.data?.length ?? 0,
        netForMe,
        pendingCount: pending.data?.length ?? 0,
      };
    },
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Tổng quan"
        description="Tóm tắt tình hình chi tiêu các nhóm của bạn"
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Users}
          label="Số nhóm"
          value={String(groups.length)}
          color="bg-primary-soft text-primary"
        />
        <StatCard
          icon={Receipt}
          label="Tổng hóa đơn"
          value={String(stats?.billCount ?? 0)}
          color="bg-accent text-accent-foreground"
        />
        <StatCard
          icon={Wallet}
          label="Cần xác nhận"
          value={String(stats?.pendingCount ?? 0)}
          color="bg-warning/20 text-warning-foreground"
        />
        <div className="p-5 rounded-xl border bg-card">
          <div className="text-xs text-muted-foreground">Số dư ròng</div>
          <div
            className={`text-2xl font-bold mt-2 ${
              (stats?.netForMe ?? 0) >= 0 ? "text-success" : "text-destructive"
            }`}
          >
            {formatVND(stats?.netForMe ?? 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {(stats?.netForMe ?? 0) >= 0 ? "Bạn đang được nợ" : "Bạn đang nợ nhóm"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Nhóm của bạn</h2>
        <Button asChild variant="outline" size="sm">
          <Link to="/groups">
            Xem tất cả <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="border rounded-xl p-12 text-center bg-card">
          <Users className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Bạn chưa có nhóm nào</p>
          <Button asChild>
            <Link to="/groups">Tạo nhóm đầu tiên</Link>
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.slice(0, 6).map((g) => (
            <Link
              key={g.id}
              to="/groups/$groupId"
              params={{ groupId: g.id }}
              className="p-5 rounded-xl border bg-card hover:shadow-card transition-shadow"
            >
              <div className="font-semibold">{g.name}</div>
              {g.description && (
                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {g.description}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-5 rounded-xl border bg-card">
      <div className={`size-9 rounded-lg grid place-items-center ${color}`}>
        <Icon className="size-4" />
      </div>
      <div className="text-xs text-muted-foreground mt-3">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
