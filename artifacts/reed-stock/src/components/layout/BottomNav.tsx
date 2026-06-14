import { LayoutDashboard, Settings, Package, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/manage", icon: Settings, label: "Manage" },
    { href: "/stok", icon: Package, label: "Stok" },
    { href: "/history", icon: Clock, label: "History" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 py-2 flex justify-between items-center safe-area-bottom">
      {navItems.map((item) => {
        const isActive = location === item.href || (location === "/" && item.href === "/dashboard");
        return (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center w-16 p-2 rounded-lg transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <item.icon className="h-6 w-6 mb-1" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}