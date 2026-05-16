import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { formatVND } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
});

function StatsPage() {
  const { user } = useAuth();

  const { data: groupIds = [] } = useQuery({
    queryKey: ["stats-gids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id);
      return (data ?? []).map((r) => r.group_id);
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["stats-bills", groupIds.join(",")],
    enabled: groupIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("bills")
        .select("total_amount, bill_date, paid_by")
        .in("group_id", groupIds);
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["stats-pays", groupIds.join(",")],
    enabled: groupIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount, from_user, to_user, status")
        .in("group_id", groupIds)
        .eq("status", "accepted");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["stats-profiles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name");
      return data ?? [];
    },
  });

  const monthly = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of bills) {
      const d = new Date(b.bill_date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[k] = (map[k] ?? 0) + Number(b.total_amount);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, total]) => ({ month, total }));
  }, [bills]);

  const totalSpent = bills.reduce((a, b) => a + Number(b.total_amount), 0);
  const totalPaid = payments.reduce((a, b) => a + Number(b.amount), 0);

  const paidByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of bills) if (b.paid_by) map[b.paid_by] = (map[b.paid_by] ?? 0) + Number(b.total_amount);
    return Object.entries(map)
      .map(([id, v]) => ({
        name: profiles.find((p) => p.id === id)?.display_name ?? "?",
        value: v,
      }))
      .sort((a, b) => b.value - a.value);
  }, [bills, profiles]);

  const topPayer = paidByUser[0];
  const leastPayer = paidByUser[paidByUser.length - 1];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader title="Thống kê" description="Tổng quan chi tiêu các nhóm bạn tham gia" />

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Card label="Tổng chi tiêu" value={formatVND(totalSpent)} />
        <Card label="Đã thanh toán" value={formatVND(totalPaid)} />
        <Card label="Tổng hóa đơn" value={String(bills.length)} />
      </div>

      <section className="border rounded-xl bg-card p-6 mb-8">
        <h3 className="font-semibold mb-4">Chi tiêu theo tháng</h3>
        {monthly.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => formatVND(v)}
                  contentStyle={{ borderRadius: 8, border: "1px solid oklch(0.92 0.01 250)" }}
                />
                <Bar dataKey="total" fill="oklch(0.62 0.18 258)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="border rounded-xl bg-card p-6">
          <h3 className="font-semibold mb-3">Người thanh toán nhiều nhất</h3>
          {topPayer ? (
            <>
              <div className="text-lg font-medium">{topPayer.name}</div>
              <div className="text-2xl font-bold text-success mt-1">{formatVND(topPayer.value)}</div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
          )}
        </div>
        <div className="border rounded-xl bg-card p-6">
          <h3 className="font-semibold mb-3">Người thanh toán ít nhất</h3>
          {leastPayer && leastPayer !== topPayer ? (
            <>
              <div className="text-lg font-medium">{leastPayer.name}</div>
              <div className="text-2xl font-bold mt-1">{formatVND(leastPayer.value)}</div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa đủ dữ liệu</p>
          )}
        </div>
      </section>
    </div>
  );
}

const Card = ({ label, value }: { label: string; value: string }) => (
  <div className="p-5 rounded-xl border bg-card">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-2xl font-bold mt-2">{value}</div>
  </div>
);
