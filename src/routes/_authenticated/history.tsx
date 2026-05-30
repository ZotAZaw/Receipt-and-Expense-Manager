import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatVND, formatDateTime, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();

  const { data: groupIds = [] } = useQuery({
    queryKey: ["history-group-ids", user?.id],
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
    queryKey: ["history-bills", groupIds.join(",")],
    enabled: groupIds.length > 0,
    queryFn: async () => {
      // No bills.paid_by -> profiles FK, so PostgREST can't embed the payer.
      // Fetch bills, then resolve payer names in a second query.
      const { data, error } = await supabase
        .from("bills")
        .select("*, groups(name)")
        .in("group_id", groupIds)
        .order("bill_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = data ?? [];
      const payerIds = [...new Set(rows.map((b) => b.paid_by).filter(Boolean) as string[])];
      const { data: profs } = payerIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", payerIds)
        : { data: [] as { id: string; display_name: string }[] };
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.display_name]));
      return rows.map((b) => ({ ...b, payer_name: b.paid_by ? nameById.get(b.paid_by) ?? "?" : null }));
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["history-payments", groupIds.join(",")],
    enabled: groupIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, groups(name)")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader title="Lịch sử" description="Xem lại toàn bộ hóa đơn và thanh toán" />
      <Tabs defaultValue="bills">
        <TabsList>
          <TabsTrigger value="bills">Hóa đơn ({bills.length})</TabsTrigger>
          <TabsTrigger value="payments">Thanh toán ({payments.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="bills" className="mt-6">
          {bills.length === 0 ? (
            <Empty />
          ) : (
            <div className="border rounded-xl bg-card divide-y">
              {bills.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{b.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {(b.groups as { name: string } | null)?.name} · {formatDate(b.bill_date)}
                      {b.payer_name && ` · ${b.payer_name} trả`}
                    </div>
                  </div>
                  <div className="font-semibold">{formatVND(Number(b.total_amount))}</div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="payments" className="mt-6">
          {payments.length === 0 ? (
            <Empty />
          ) : (
            <div className="border rounded-xl bg-card divide-y">
              {payments.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{formatVND(Number(p.amount))}</div>
                    <div className="text-xs text-muted-foreground">
                      {(p.groups as { name: string } | null)?.name} ·{" "}
                      {formatDateTime(p.created_at)}
                    </div>
                  </div>
                  <Badge variant={p.status === "accepted" ? "default" : "secondary"}>
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Empty = () => (
  <div className="border rounded-xl p-12 text-center bg-card text-sm text-muted-foreground">
    Chưa có dữ liệu
  </div>
);
