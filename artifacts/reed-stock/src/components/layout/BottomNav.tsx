import { LayoutDashboard, Settings, Package, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/manage",    icon: Settings,         label: "Manage"    },
    { href: "/stok",      icon: Package,           label: "Stok"      },
    { href: "/history",   icon: Clock,             label: "History"   },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur border-t border-border/60 px-2 py-2 flex justify-between items-center safe-area-bottom">
      {navItems.map((item) => {
        const isActive =
          location === item.href ||
          (location === "/" && item.href === "/dashboard");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex flex-col items-center justify-center w-16 py-1.5 px-2 rounded-xl transition-all duration-200 active:scale-90 ${
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {/* Active background pill */}
            {isActive && (
              <span className="absolute inset-0 rounded-xl bg-primary/10 transition-all duration-200" />
            )}

            {/* Icon with glow when active */}
            <item.icon
              className={`h-5 w-5 mb-0.5 transition-all duration-200 ${
                isActive
                  ? "scale-110 drop-shadow-[0_0_6px_rgba(var(--primary-rgb,34,197,94),0.6)]"
                  : "scale-100"
              }`}
            />

            <span
              className={`text-[10px] transition-all duration-200 ${
                isActive ? "font-semibold" : "font-medium"
              }`}
            >
              {item.label}
            </span>

            {/* Active dot indicator */}
            {isActive && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
