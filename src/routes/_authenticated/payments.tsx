import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X, Undo2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { formatVND, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, groups(name)")
        .or(`from_user.eq.${user!.id},to_user.eq.${user!.id}`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const userIds = useMemo(() => {
    const s = new Set<string>();
    payments.forEach((p) => {
      s.add(p.from_user);
      s.add(p.to_user);
    });
    return Array.from(s);
  }, [payments]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-payments", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      return data ?? [];
    },
  });
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.display_name ?? "?";

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "rejected" | "reverted" }) => {
      const { error } = await supabase
        .from("payments")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã cập nhật");
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const incoming = payments.filter((p) => p.to_user === user?.id && p.status === "pending");
  const outgoing = payments.filter((p) => p.from_user === user?.id);
  const received = payments.filter((p) => p.to_user === user?.id && p.status !== "pending");

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Thanh toán"
        description="Quản lý yêu cầu thanh toán giữa các thành viên"
        actions={<SendPaymentDialog />}
      />

      <section className="mb-8">
        <h2 className="font-semibold mb-3">Yêu cầu cần xác nhận ({incoming.length})</h2>
        {incoming.length === 0 ? (
          <div className="border rounded-xl p-6 text-sm text-muted-foreground text-center bg-card">
            Không có yêu cầu nào
          </div>
        ) : (
          <div className="border rounded-xl bg-card divide-y">
            {incoming.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm">
                    <span className="font-medium">{nameOf(p.from_user)}</span> đề nghị thanh toán{" "}
                    <span className="font-semibold text-primary">{formatVND(p.amount)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Nhóm {(p.groups as { name: string } | null)?.name} ·{" "}
                    {formatDateTime(p.created_at)}
                    {p.note && ` · "${p.note}"`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => respond.mutate({ id: p.id, status: "accepted" })}
                  >
                    <Check className="size-4" /> Xác nhận
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => respond.mutate({ id: p.id, status: "rejected" })}
                  >
                    <X className="size-4" /> Từ chối
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="font-semibold mb-3">Bạn đã gửi ({outgoing.length})</h2>
        <PaymentList payments={outgoing} nameOf={nameOf} onRevert={(id) => respond.mutate({ id, status: "reverted" })} />
      </section>

      <section>
        <h2 className="font-semibold mb-3">Bạn đã nhận ({received.length})</h2>
        <PaymentList payments={received} nameOf={nameOf} />
      </section>
    </div>
  );
}

function statusBadge(s: string) {
  const map: Record<string, { v: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { v: "secondary", label: "Chờ xác nhận" },
    accepted: { v: "default", label: "Đã xác nhận" },
    rejected: { v: "destructive", label: "Từ chối" },
    reverted: { v: "outline", label: "Đã hoàn" },
  };
  const x = map[s] ?? { v: "outline" as const, label: s };
  return <Badge variant={x.v}>{x.label}</Badge>;
}

interface PaymentRow {
  id: string;
  from_user: string;
  to_user: string;
  amount: number;
  status: string;
  note: string | null;
  created_at: string;
  groups: { name: string } | null;
}

function PaymentList({
  payments,
  nameOf,
  onRevert,
}: {
  payments: PaymentRow[];
  nameOf: (id: string) => string;
  onRevert?: (id: string) => void;
}) {
  if (payments.length === 0)
    return (
      <div className="border rounded-xl p-6 text-sm text-muted-foreground text-center bg-card">
        Chưa có giao dịch
      </div>
    );
  return (
    <div className="border rounded-xl bg-card divide-y">
      {payments.map((p) => (
        <div key={p.id} className="p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm">
              <span className="font-medium">{nameOf(p.from_user)}</span> →{" "}
              <span className="font-medium">{nameOf(p.to_user)}</span> ·{" "}
              <span className="font-semibold">{formatVND(p.amount)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {(p.groups as { name: string } | null)?.name} · {formatDateTime(p.created_at)}
              {p.note && ` · "${p.note}"`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge(p.status)}
            {onRevert && p.status === "accepted" && (
              <Button size="sm" variant="ghost" onClick={() => onRevert(p.id)}>
                <Undo2 className="size-4" /> Hoàn
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SendPaymentDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [toUser, setToUser] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["my-groups-min", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("groups(id, name)")
        .eq("user_id", user!.id);
      return ((data ?? [])
        .map((r) => r.groups)
        .filter(Boolean) as Array<{ id: string; name: string }>);
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-members-min", groupId, user?.id],
    enabled: !!groupId,
    queryFn: async () => {
      // No FK from group_members.user_id -> profiles, so PostgREST can't embed
      // profiles. Fetch members then resolve names in a second query.
      const { data: gm, error } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId);
      if (error) throw error;
      const ids = (gm ?? []).map((m) => m.user_id).filter((id) => id !== user?.id);
      if (ids.length === 0) return [] as Array<{ user_id: string; display_name: string }>;
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      if (pErr) throw pErr;
      return (profs ?? []).map((p) => ({
        user_id: p.id,
        display_name: p.display_name ?? "?",
      }));
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({
        group_id: groupId,
        from_user: user!.id,
        to_user: toUser,
        amount: Number(amount),
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã gửi yêu cầu thanh toán");
      setOpen(false);
      setGroupId("");
      setToUser("");
      setAmount("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Gửi yêu cầu
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gửi yêu cầu thanh toán</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nhóm</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn nhóm" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Người nhận</Label>
            <Select value={toUser} onValueChange={setToUser} disabled={!groupId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn người nhận" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Số tiền (VND)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ghi chú (tùy chọn)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Hủy
          </Button>
          <Button
            onClick={() => send.mutate()}
            disabled={!groupId || !toUser || !amount || send.isPending}
          >
            Gửi yêu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
