import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/groups")({
  component: GroupsPage,
});

function GroupsPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  if (pathname !== "/groups") {
    return <Outlet />;
  }

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
                <div className="text-sm text-muted-foreground line-clamp-2">
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
