"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getInitials, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  LogOut,
  Settings,
  Menu,
  X,
  TrendingUp,
  LayoutDashboard,
  Megaphone,
  CreditCard,
  Database,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/lists",     label: "Lists",     icon: Database },
  { href: "/billing",   label: "Billing",   icon: CreditCard },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

interface TopBarProps {
  user: User;
  isTrialing: boolean;
  trialDaysLeft: number;
}

export function TopBar({ user, isTrialing, trialDaysLeft }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = getInitials(user.email?.split("@")[0] ?? "U");

  return (
    <>
      <header className="flex items-center justify-between h-14 px-4 md:px-6 border-b border-border bg-background shrink-0">
        {/* Mobile: hamburger + logo */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold leading-none">CampaignFlow</span>
          </Link>
        </div>

        {/* Trial banner (desktop) */}
        {isTrialing && trialDaysLeft <= 3 && (
          <div className="hidden md:flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {trialDaysLeft === 0
                ? "Trial expired."
                : `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left in trial.`}{" "}
              <Link href="/billing" className="font-medium underline hover:no-underline">
                Upgrade now
              </Link>
            </span>
          </div>
        )}

        {/* Trial banner (mobile — below logo row, shown inline here) */}
        {isTrialing && trialDaysLeft <= 3 && (
          <div className="flex md:hidden items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <Link href="/billing" className="font-medium underline">
              {trialDaysLeft === 0 ? "Trial expired" : `${trialDaysLeft}d left`}
            </Link>
          </div>
        )}

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/settings" className="hidden md:block">
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <span className="hidden sm:block text-sm text-muted-foreground max-w-[160px] truncate">
              {user.email}
            </span>
          </div>

          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-brand-950 shadow-lg">
          <nav className="px-3 py-3 space-y-0.5">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive
                      ? "bg-brand-700 text-white"
                      : "text-brand-300 hover:bg-brand-800 hover:text-white"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
