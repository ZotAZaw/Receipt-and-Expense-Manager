import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Receipt,
  Users,
  Calculator,
  Wallet,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

const features = [
  {
    icon: Users,
    title: "Quản lý nhóm",
    desc: "Tạo nhóm, mời thành viên, phân quyền admin / member rõ ràng.",
  },
  {
    icon: Receipt,
    title: "Hóa đơn linh hoạt",
    desc: "Chia đều, chia từng người, theo phần trăm, hoặc trừ vào quỹ nhóm.",
  },
  {
    icon: Calculator,
    title: "Tự động tính công nợ",
    desc: "Hệ thống tự tính ai nợ ai, gợi ý số giao dịch tối thiểu để cấn trừ.",
  },
  {
    icon: Wallet,
    title: "Thanh toán có xác nhận",
    desc: "Gửi yêu cầu thanh toán, hai bên xác nhận thì hệ thống mới ghi nhận.",
  },
  {
    icon: TrendingUp,
    title: "Thống kê trực quan",
    desc: "Biểu đồ chi tiêu theo tháng, người chi nhiều / nợ nhiều nhất.",
  },
  {
    icon: CheckCircle2,
    title: "Lịch sử minh bạch",
    desc: "Xem lại mọi hóa đơn, mọi giao dịch — không sợ cãi nhau vì tiền.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">
              ₫
            </div>
            <span className="font-semibold text-lg">ChiaTien</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/auth">Đăng nhập</Link>
            </Button>
            <Button asChild>
              <Link to="/auth" search={{ mode: "signup" }}>
                Bắt đầu miễn phí
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-medium mb-6">
          <span className="size-1.5 rounded-full bg-primary" /> Quản lý chi tiêu nhóm thông minh
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto">
          Chia hóa đơn, theo dõi công nợ
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          ChiaTien giúp nhóm bạn ghi nhận hóa đơn chung, tự động tính ai nợ ai và gợi ý cách
          thanh toán tối ưu. Phù hợp cho bạn bè đi du lịch, ở ghép, ăn uống nhóm.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/auth" search={{ mode: "signup" }}>
              Tạo tài khoản miễn phí <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/auth">Đăng nhập</Link>
          </Button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl border bg-card hover:shadow-card transition-shadow"
            >
              <div className="size-10 rounded-lg bg-primary-soft text-primary grid place-items-center mb-4">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-6 text-sm text-muted-foreground text-center">
          © 2026 ChiaTien. Quản lý chi tiêu nhóm.
        </div>
      </footer>
    </div>
  );
}
