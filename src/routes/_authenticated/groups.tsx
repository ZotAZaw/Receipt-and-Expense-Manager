import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatVND } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: m } = await supabase
        .from("group_members")
        .select("groups(id, name, description, created_at)")
        .eq("user_id", user!.id);
      return ((m ?? [])
        .map((r) => r.groups)
        .filter(Boolean) as Array<{
        id: string;
        name: string;
        description: string | null;
        created_at: string;
      }>).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
  });

  // Current user's net balance in each group (+ owed to them, - they owe).
  const groupIds = groups.map((g) => g.id);
  const { data: balances = {} } = useQuery<Record<string, number>>({
    queryKey: ["group-balances", user?.id, groupIds.join(",")],
    enabled: !!user && groupIds.length > 0,
    queryFn: async () => {
      const [billsRes, paysRes] = await Promise.all([
        supabase
          .from("bills")
          .select("group_id, total_amount, paid_by, bill_splits(user_id, amount)")
          .in("group_id", groupIds),
        supabase
          .from("payments")
          .select("group_id, from_user, to_user, amount, status")
          .in("group_id", groupIds),
      ]);
      if (billsRes.error) throw billsRes.error;
      if (paysRes.error) throw paysRes.error;
      const bills = billsRes.data;
      const pays = paysRes.data;
      const bal: Record<string, number> = {};
      groupIds.forEach((id) => (bal[id] = 0));
      for (const b of bills ?? []) {
        if (b.paid_by === user!.id) bal[b.group_id] += Number(b.total_amount);
        for (const s of (b.bill_splits as { user_id: string; amount: number }[]) ?? []) {
          if (s.user_id === user!.id) bal[b.group_id] -= Number(s.amount);
        }
      }
      for (const p of pays ?? []) {
        if (p.status !== "accepted") continue;
        if (p.from_user === user!.id) bal[p.group_id] += Number(p.amount);
        if (p.to_user === user!.id) bal[p.group_id] -= Number(p.amount);
      }
      for (const k of Object.keys(bal)) bal[k] = Math.round(bal[k] * 100) / 100;
      return bal;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("groups")
        .insert({ name, description: desc || null, owner_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã tạo nhóm");
      setOpen(false);
      setName("");
      setDesc("");
      qc.invalidateQueries({ queryKey: ["groups"] });
      qc.invalidateQueries({ queryKey: ["dashboard-groups"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Nhóm của bạn"
        description="Quản lý các nhóm chi tiêu chung"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Tạo nhóm
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tạo nhóm mới</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tên nhóm</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Đi Đà Lạt 2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mô tả (tùy chọn)</Label>
                  <Textarea
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Mô tả ngắn về nhóm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Hủy
                </Button>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!name.trim() || create.isPending}
                >
                  Tạo nhóm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="text-muted-foreground">Đang tải...</div>
      ) : groups.length === 0 ? (
        <div className="border rounded-xl p-12 text-center bg-card">
          <Users className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Bạn chưa có nhóm nào</p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Tạo nhóm đầu tiên
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Link
              key={g.id}
              to="/groups/$groupId"
              params={{ groupId: g.id }}
              className="p-5 rounded-xl border bg-card hover:shadow-card transition-shadow"
            >
              <div className="font-semibold mb-1">{g.name}</div>
              {g.description && (
                <div className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {g.description}
                </div>
              )}
              {(() => {
                const v = balances[g.id] ?? 0;
                const label =
                  v > 0 ? "Bạn được nhận" : v < 0 ? "Bạn nợ" : "Đã cân bằng";
                return (
                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span
                      className={`font-semibold ${
                        v > 0 ? "text-success" : v < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatVND(Math.abs(v))}
                    </span>
                  </div>
                );
              })()}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
