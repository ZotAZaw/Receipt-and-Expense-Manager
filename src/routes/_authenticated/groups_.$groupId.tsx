import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ArrowLeft, Trash2, UserPlus, Receipt } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { formatVND, formatDate, initials } from "@/lib/format";
import { computeBalances, minimizeTransfers } from "@/lib/debt-math";

export const Route = createFileRoute("/_authenticated/groups_/$groupId")({
  component: GroupDetail,
});

type SplitMethod = "equal" | "exact" | "percent" | "fund";

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .eq("id", groupId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery<MemberRow[]>({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      const { data: gm, error } = await supabase
        .from("group_members")
        .select("id, role, user_id, joined_at")
        .eq("group_id", groupId);
      if (error) throw error;
      const ids = (gm ?? []).map((m) => m.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, display_name, email").in("id", ids)
        : { data: [] as { id: string; display_name: string; email: string }[] };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return (gm ?? []).map((m) => ({
        ...m,
        profiles: map.get(m.user_id)
          ? { display_name: map.get(m.user_id)!.display_name, email: map.get(m.user_id)!.email }
          : null,
      })) as MemberRow[];
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["bills", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*, bill_splits(*)")
        .eq("group_id", groupId)
        .order("bill_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments-group", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("group_id", groupId);
      return data ?? [];
    },
  });

  const memberMap = useMemo(() => {
    const m: Record<string, { name: string; email: string }> = {};
    for (const mb of members) {
      const p = mb.profiles as unknown as { display_name: string; email: string } | null;
      m[mb.user_id] = { name: p?.display_name ?? "?", email: p?.email ?? "" };
    }
    return m;
  }, [members]);

  const balances = useMemo(() => {
    const memberIds = members.map((m) => m.user_id);
    const billsForCalc = bills.map((b) => ({
      id: b.id,
      total_amount: Number(b.total_amount),
      paid_by: b.paid_by,
      splits: ((b.bill_splits as Array<{ user_id: string; amount: number }>) ?? []).map(
        (s) => ({ user_id: s.user_id, amount: Number(s.amount) }),
      ),
    }));
    return computeBalances(memberIds, billsForCalc, payments);
  }, [members, bills, payments]);

  const transfers = useMemo(() => minimizeTransfers(balances), [balances]);

  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link
        to="/groups"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="size-4" /> Quay lại danh sách nhóm
      </Link>

      <PageHeader
        title={group?.name ?? "Nhóm"}
        description={group?.description ?? "Quản lý hóa đơn, công nợ và thanh toán trong nhóm"}
        actions={<CreateBillDialog groupId={groupId} members={members} />}
      />

      <Tabs defaultValue="bills">
        <TabsList>
          <TabsTrigger value="bills">Hóa đơn</TabsTrigger>
          <TabsTrigger value="debts">Công nợ</TabsTrigger>
          <TabsTrigger value="members">Thành viên</TabsTrigger>
        </TabsList>

        <TabsContent value="bills" className="mt-6">
          {bills.length === 0 ? (
            <div className="border rounded-xl p-12 text-center bg-card">
              <Receipt className="size-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Chưa có hóa đơn nào trong nhóm</p>
            </div>
          ) : (
            <div className="border rounded-xl bg-card divide-y">
              {bills.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(b.bill_date)} ·{" "}
                      {b.paid_by ? `Trả bởi ${memberMap[b.paid_by]?.name}` : "Từ quỹ nhóm"} ·{" "}
                      {splitLabel(b.split_method as SplitMethod)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatVND(Number(b.total_amount))}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="debts" className="mt-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">Số dư từng thành viên</h3>
            <div className="border rounded-xl bg-card divide-y">
              {members.map((m) => {
                const v = balances[m.user_id] ?? 0;
                return (
                  <div key={m.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary-soft text-primary grid place-items-center text-xs font-semibold">
                        {initials(memberMap[m.user_id]?.name)}
                      </div>
                      <div>
                        <div className="font-medium">{memberMap[m.user_id]?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {memberMap[m.user_id]?.email}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`font-semibold ${
                        v > 0 ? "text-success" : v < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {v > 0 ? "+" : ""}
                      {formatVND(v)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">
              Gợi ý thanh toán tối ưu ({transfers.length} giao dịch)
            </h3>
            {transfers.length === 0 ? (
              <div className="border rounded-xl p-6 text-center bg-card text-sm text-muted-foreground">
                Mọi thành viên đã cân bằng ✓
              </div>
            ) : (
              <div className="border rounded-xl bg-card divide-y">
                {transfers.map((t, i) => (
                  <div key={i} className="p-4 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{memberMap[t.from]?.name}</span>
                      <span className="text-muted-foreground"> trả </span>
                      <span className="font-medium">{memberMap[t.to]?.name}</span>
                    </div>
                    <div className="font-semibold text-primary">{formatVND(t.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="members" className="mt-6 space-y-4">
          {canManage && <AddMemberControl groupId={groupId} />}
          <div className="border rounded-xl bg-card divide-y">
            {members.map((m) => {
              const p = m.profiles as unknown as { display_name: string; email: string } | null;
              return (
                <div key={m.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary-soft text-primary grid place-items-center text-xs font-semibold">
                      {initials(p?.display_name)}
                    </div>
                    <div>
                      <div className="font-medium">{p?.display_name}</div>
                      <div className="text-xs text-muted-foreground">{p?.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                      {m.role}
                    </Badge>
                    {canManage && m.role !== "owner" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm("Xóa thành viên này?")) return;
                          await supabase.from("group_members").delete().eq("id", m.id);
                          qc.invalidateQueries({ queryKey: ["group-members", groupId] });
                          toast.success("Đã xóa thành viên");
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {group?.owner_id === user?.id && (
            <DangerZone
              groupId={groupId}
              groupName={group?.name ?? "nhóm này"}
              settled={transfers.length === 0}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DangerZone({
  groupId,
  groupName,
  settled,
}: {
  groupId: string;
  groupName: string;
  settled: boolean;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const del = useMutation({
    mutationFn: async () => {
      // Delete in FK dependency order (works whether or not FKs cascade):
      // bill_splits -> bills -> payments -> group_members -> group.
      const { data: billRows, error: bErr } = await supabase
        .from("bills")
        .select("id")
        .eq("group_id", groupId);
      if (bErr) throw bErr;
      const billIds = (billRows ?? []).map((b) => b.id);
      if (billIds.length) {
        const { error } = await supabase.from("bill_splits").delete().in("bill_id", billIds);
        if (error) throw error;
      }
      const { error: e1 } = await supabase.from("bills").delete().eq("group_id", groupId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("payments").delete().eq("group_id", groupId);
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("group_members").delete().eq("group_id", groupId);
      if (e3) throw e3;
      const { error: e4 } = await supabase.from("groups").delete().eq("id", groupId);
      if (e4) throw e4;
    },
    onSuccess: () => {
      toast.success("Đã xóa nhóm");
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["dashboard-groups"] });
      navigate({ to: "/groups" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Không thể xóa nhóm"),
  });

  return (
    <div className="border border-destructive/40 rounded-xl p-5 bg-destructive/5">
      <h3 className="font-semibold text-destructive mb-1">Khu vực nguy hiểm</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Xóa nhóm sẽ xóa vĩnh viễn toàn bộ hóa đơn, công nợ và thanh toán của nhóm. Hành động này
        không thể hoàn tác.
      </p>
      {!settled && (
        <p className="text-sm text-destructive mb-3">
          Chỉ có thể xóa khi mọi thành viên đã cân bằng công nợ (không còn ai nợ ai).
        </p>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={!settled || del.isPending}>
            <Trash2 className="size-4" /> Xóa nhóm
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa nhóm "{groupName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ hóa đơn, công nợ và thanh toán của nhóm sẽ bị xóa vĩnh viễn. Bạn chắc chắn?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => del.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa vĩnh viễn
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function splitLabel(m: SplitMethod) {
  return { equal: "Chia đều", exact: "Chia từng người", percent: "Chia %", fund: "Quỹ nhóm" }[m];
}

function AddMemberControl({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const add = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim())
        .maybeSingle();
      if (error) throw error;
      if (!prof) {
        toast.error("Không tìm thấy người dùng với email này");
        return;
      }
      const { error: insErr } = await supabase
        .from("group_members")
        .insert({ group_id: groupId, user_id: prof.id, role: "member" });
      if (insErr) throw insErr;
      toast.success("Đã thêm thành viên");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["group-members", groupId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Email thành viên cần thêm"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button onClick={add} disabled={loading}>
        <UserPlus className="size-4" /> Thêm
      </Button>
    </div>
  );
}

interface MemberRow {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  profiles: { display_name: string; email: string } | null;
}

function CreateBillDialog({ groupId, members }: { groupId: string; members: MemberRow[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [paidBy, setPaidBy] = useState(user?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const totalNum = Number(total) || 0;
  const selectedIds = method === "fund" ? members.map((m) => m.user_id) : selected;

  const reset = () => {
    setTitle("");
    setTotal("");
    setMethod("equal");
    setPaidBy(user?.id ?? "");
    setSelected([]);
    setAmounts({});
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const computeSplits = (): { user_id: string; amount: number; percentage?: number }[] => {
    if (method === "equal") {
      if (selectedIds.length === 0) return [];
      const per = totalNum / selectedIds.length;
      return selectedIds.map((id) => ({ user_id: id, amount: Math.round(per * 100) / 100 }));
    }
    if (method === "fund") {
      const per = totalNum / members.length;
      return members.map((m) => ({
        user_id: m.user_id,
        amount: Math.round(per * 100) / 100,
      }));
    }
    if (method === "exact") {
      return selectedIds.map((id) => ({
        user_id: id,
        amount: Number(amounts[id]) || 0,
      }));
    }
    // percent
    return selectedIds.map((id) => {
      const pct = Number(amounts[id]) || 0;
      return {
        user_id: id,
        amount: Math.round(((totalNum * pct) / 100) * 100) / 100,
        percentage: pct,
      };
    });
  };

  const splitsPreview = computeSplits();
  const splitsSum = splitsPreview.reduce((a, b) => a + b.amount, 0);
  const valid =
    title.trim() &&
    totalNum > 0 &&
    splitsPreview.length > 0 &&
    Math.abs(splitsSum - totalNum) < 0.5;

  const save = useMutation({
    mutationFn: async () => {
      const { data: bill, error } = await supabase
        .from("bills")
        .insert({
          group_id: groupId,
          title,
          total_amount: totalNum,
          paid_by: method === "fund" ? null : paidBy,
          split_method: method,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;

      const splits = splitsPreview.map((s) => ({ ...s, bill_id: bill.id }));
      const { error: splitErr } = await supabase.from("bill_splits").insert(splits);
      if (splitErr) throw splitErr;
    },
    onSuccess: () => {
      toast.success("Đã tạo hóa đơn");
      setOpen(false);
      reset();
      qc.invalidateQueries({ queryKey: ["bills", groupId] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : (setOpen(false), reset()))}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Thêm hóa đơn
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo hóa đơn mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tên hóa đơn</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ăn tối" />
            </div>
            <div className="space-y-2">
              <Label>Tổng tiền (VND)</Label>
              <Input
                type="number"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="500000"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cách chia</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as SplitMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Chia đều</SelectItem>
                  <SelectItem value="exact">Chia từng người</SelectItem>
                  <SelectItem value="percent">Chia phần trăm</SelectItem>
                  <SelectItem value="fund">Trừ vào quỹ nhóm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {method !== "fund" && (
              <div className="space-y-2">
                <Label>Người trả</Label>
                <Select value={paidBy} onValueChange={setPaidBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profiles?.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {method !== "fund" && (
            <div className="space-y-2">
              <Label>Thành viên tham gia</Label>
              <div className="border rounded-lg divide-y">
                {members.map((m) => {
                  const checked = selected.includes(m.user_id);
                  return (
                    <div key={m.user_id} className="p-3 flex items-center gap-3">
                      <Checkbox checked={checked} onCheckedChange={() => toggle(m.user_id)} />
                      <div className="flex-1">{m.profiles?.display_name}</div>
                      {(method === "exact" || method === "percent") && checked && (
                        <Input
                          className="w-32"
                          type="number"
                          placeholder={method === "percent" ? "%" : "VND"}
                          value={amounts[m.user_id] ?? ""}
                          onChange={(e) =>
                            setAmounts({ ...amounts, [m.user_id]: e.target.value })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Tổng chia: {formatVND(splitsSum)} / {formatVND(totalNum)}
            {!valid && totalNum > 0 && splitsPreview.length > 0 && (
              <span className="text-destructive ml-2">(Không khớp tổng)</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Hủy
          </Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            Lưu hóa đơn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
