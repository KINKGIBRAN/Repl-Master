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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, Factory } from "lucide-react";

function AdminBar() {
  const { isAdmin, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!pin) return;
    setLoading(true);
    setError("");
    const ok = await login(pin);
    setLoading(false);
    if (ok) {
      setOpen(false);
      setPin("");
    } else {
      setError("PIN salah. Coba lagi.");
    }
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 h-9 bg-background/95 backdrop-blur border-b border-border/60 flex items-center justify-between px-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Factory className="h-3.5 w-3.5 text-primary" />
          <span className="hidden xs:inline">PT. TRIPUTRA TEXTILE</span>
          <span className="xs:hidden">TRIPUTRA</span>
        </div>
        {isAdmin ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
              <Unlock className="h-3.5 w-3.5" />
              <span>ADMIN MODE</span>
            </div>
            <button onClick={logout} className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/60">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" /> Login Admin
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Masukkan PIN untuk mengakses mode edit.</p>
            <Input
              type="password"
              placeholder="PIN Admin"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); setPin(""); }} className="flex-1">Batal</Button>
            <Button onClick={handleLogin} disabled={loading || !pin} className="flex-1">
              {loading ? "Memverifikasi..." : "Masuk"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
