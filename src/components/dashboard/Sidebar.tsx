"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Settings,
  CreditCard,
  TrendingUp,
  ChevronRight,
  Database,
  FileBarChart2,
  Zap,
  Inbox,
  MessageSquare,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    badge: null,
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    icon: Megaphone,
    badge: null,
  },
  {
    href: "/lists",
    label: "Lists",
    icon: Database,
    badge: null,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: FileBarChart2,
    badge: null,
  },
  {
    href: "/super-agent",
    label: "Super Agent",
    icon: Bot,
    badge: "NEW",
  },
  {
    href: "/super-dm-setter",
    label: "Super DM Setter",
    icon: Zap,
    badge: null,
  },
  {
    href: "/inbox",
    label: "Inbox",
    icon: Inbox,
    badge: null,
  },
  {
    href: "/automations",
    label: "Automations",
    icon: MessageSquare,
    badge: "NEW",
  },
  {
    href: "/billing",
    label: "Billing",
    icon: CreditCard,
    badge: null,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    badge: null,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 flex-col bg-brand-950 border-r border-brand-800">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-brand-800">
        <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-lg flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">CampaignFlow</p>
          <p className="text-xs text-brand-400 leading-none mt-0.5">Pro</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group",
                isActive
                  ? "bg-brand-700 text-white"
                  : "text-brand-300 hover:bg-brand-800 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && !isActive && (
                <span className="text-[9px] font-bold tracking-wider bg-brand-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                  {item.badge}
                </span>
              )}
              {isActive && <ChevronRight className="h-3 w-3 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-brand-800">
        <p className="text-xs text-brand-500">
          CampaignFlow Pro v1.0
        </p>
      </div>
    </aside>
  );
}
