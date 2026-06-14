import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import ManagePage from "@/pages/manage";
import StokPage from "@/pages/stok";
import HistoryPage from "@/pages/history";
import { BottomNav } from "@/components/layout/BottomNav";

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
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <div className="min-h-[100dvh] bg-background text-foreground pb-20">
          <Router />
          <BottomNav />
        </div>
      </WouterRouter>
      <Toaster theme="dark" />
    </TooltipProvider>
  );
}

export default App;
