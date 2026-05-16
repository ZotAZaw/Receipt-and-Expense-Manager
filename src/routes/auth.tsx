import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";

const passwordRules = [
  { label: "Tối thiểu 8 ký tự", test: (p: string) => p.length >= 8 },
  { label: "Có chữ hoa (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Có chữ thường (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { label: "Có chữ số (0-9)", test: (p: string) => /\d/.test(p) },
];

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const { mode: initial } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">(initial ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const allRulesMet = mode === "signup" && passwordRules.every((r) => r.test(password));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const failed = passwordRules.filter((r) => !r.test(password));
        if (failed.length > 0) {
          toast.error("Mật khẩu chưa đáp ứng yêu cầu");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Đã tạo tài khoản! Kiểm tra email để xác nhận.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Đăng nhập thành công");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error("Đăng nhập Google thất bại");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-primary-foreground text-primary grid place-items-center font-bold">
            ₫
          </div>
          <span className="font-semibold text-lg">ChiaTien</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">Chia hóa đơn dễ dàng cho cả nhóm</h2>
          <p className="opacity-90">
            Tạo nhóm, ghi nhận chi tiêu, để hệ thống tự tính ai nợ ai. Không còn cảnh nhắc tiền
            ngại ngùng.
          </p>
        </div>
        <p className="text-sm opacity-75">© 2026 ChiaTien</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-2xl font-bold">
              {mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signup"
                ? "Bắt đầu quản lý chi tiêu nhóm của bạn"
                : "Chào mừng bạn quay lại"}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={googleSignIn}
            disabled={loading}
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Tiếp tục với Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">hoặc</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Tên hiển thị</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="ban@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 8 : undefined}
                placeholder={mode === "signup" ? "Tạo mật khẩu mạnh" : "Mật khẩu"}
              />
              {mode === "signup" && (
                <ul className="space-y-1 pt-1">
                  {passwordRules.map((r) => {
                    const ok = r.test(password);
                    return (
                      <li
                        key={r.label}
                        className={`flex items-center gap-2 text-xs ${
                          ok ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                        {r.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading || (mode === "signup" && !allRulesMet)}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "signup" ? "Đăng ký" : "Đăng nhập"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            {mode === "signup" ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
            <button
              onClick={() => setMode(mode === "signup" ? "login" : "signup")}
              className="text-primary font-medium hover:underline"
            >
              {mode === "signup" ? "Đăng nhập" : "Đăng ký ngay"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
