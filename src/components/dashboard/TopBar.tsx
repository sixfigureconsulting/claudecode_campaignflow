"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LogOut, Settings } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface TopBarProps {
  user: User;
  isTrialing: boolean;
  trialDaysLeft: number;
}

export function TopBar({ user, isTrialing, trialDaysLeft }: TopBarProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const initials = getInitials(user.email?.split("@")[0] ?? "U");

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background shrink-0">
      {/* Trial banner */}
      {isTrialing && trialDaysLeft <= 3 && (
        <div className="flex items-center gap-2 text-sm text-amber-600">
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

      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
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
  );
}
