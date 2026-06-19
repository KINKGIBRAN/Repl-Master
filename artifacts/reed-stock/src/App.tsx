import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import ManagePage from "@/pages/manage";
import StokPage from "@/pages/stok";
import HistoryPage from "@/pages/history";
import { BottomNav } from "@/components/layout/BottomNav";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LoginDialog } from "@/components/LoginDialog";
import { Lock, Unlock, Factory, User } from "lucide-react";

function AdminBar() {
  const { isAdmin, currentUser, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 h-9 bg-background/95 backdrop-blur border-b border-border/60 flex items-center justify-between px-4">
        {/* Brand */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Factory className="h-3.5 w-3.5 text-primary" />
          <span className="hidden xs:inline tracking-widest uppercase text-[10px]">PT. Triputra Textile</span>
          <span className="xs:hidden tracking-widest uppercase text-[10px]">Triputra</span>
        </div>

        {/* User info */}
        {isAdmin && currentUser ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B9FD4]">
              <Unlock className="h-3 w-3 text-[#6B9FD4]/70" />
              <span className="truncate max-w-[140px]">{currentUser.nama}</span>
            </div>
            <button
              onClick={logout}
              className="text-[10px] text-muted-foreground/70 hover:text-foreground px-1.5 py-0.5 rounded border border-border/50 hover:border-border transition-colors"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-[#6B9FD4] transition-colors"
          >
            <Lock className="h-3 w-3" />
            <span>Login Admin</span>
          </button>
        )}
      </div>

      <LoginDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/manage" component={ManagePage} />
      <Route path="/stok" component={StokPage} />
      <Route path="/history" component={HistoryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AdminBar />
          <div className="min-h-[100dvh] bg-background text-foreground pb-20 pt-9">
            <Router />
            <BottomNav />
          </div>
        </WouterRouter>
        <Toaster
          theme="dark"
          position="bottom-center"
          offset={72}
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: "12px",
              fontSize: "13px",
              padding: "12px 16px",
              background: "hsl(214 45% 13%)",
              border: "1px solid hsl(214 45% 21%)",
              color: "hsl(216 36% 94%)",
            },
          }}
        />
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
