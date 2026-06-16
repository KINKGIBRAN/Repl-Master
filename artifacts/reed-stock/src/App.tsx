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
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Factory className="h-3.5 w-3.5 text-primary" />
          <span className="hidden xs:inline">PT. TRIPUTRA TEXTILE</span>
          <span className="xs:hidden">TRIPUTRA</span>
        </div>

        {isAdmin && currentUser ? (
          <div className="flex items-center gap-2">
            {/* Nama & role user yang sedang login */}
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
              <Unlock className="h-3.5 w-3.5" />
              <User className="h-3 w-3" />
              <span>{currentUser.nama}</span>
              <span className="text-emerald-400/60">· {currentUser.role}</span>
            </div>
            <button
              onClick={logout}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/60"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Lock className="h-3.5 w-3.5" />
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
        <Toaster theme="dark" />
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;