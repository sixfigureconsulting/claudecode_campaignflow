import Link from "next/link";
import { Zap } from "lucide-react";

interface SocialCampaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  total_leads: number;
  sent_count: number;
  reply_count: number;
  failed_count: number;
  created_at: string;
}

const CHANNEL_META: Record<string, { emoji: string; label: string }> = {
  linkedin:  { emoji: "💼", label: "LinkedIn" },
  reddit:    { emoji: "🔴", label: "Reddit" },
  twitter:   { emoji: "🐦", label: "Twitter/X" },
  instagram: { emoji: "📸", label: "Instagram" },
  facebook:  { emoji: "👥", label: "Facebook" },
  email:     { emoji: "✉️", label: "Email" },
};

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  draft:     "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400",
  paused:    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  failed:    "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

export function SocialCampaignStatsTable({ campaigns }: { campaigns: SocialCampaign[] }) {
  if (campaigns.length === 0) return null;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Zap className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Social DM Campaign Stats</h2>
        <span className="ml-auto text-xs text-muted-foreground">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-5 py-2.5 font-medium">Campaign</th>
              <th className="text-left px-3 py-2.5 font-medium">Channel</th>
              <th className="text-right px-3 py-2.5 font-medium">Leads</th>
              <th className="text-right px-3 py-2.5 font-medium">Sent</th>
              <th className="text-right px-3 py-2.5 font-medium">Replies</th>
              <th className="text-right px-3 py-2.5 font-medium">Reply Rate</th>
              <th className="text-right px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {campaigns.map((c) => {
              const meta = CHANNEL_META[c.channel] ?? { emoji: "📨", label: c.channel };
              const rate = c.sent_count > 0 ? ((c.reply_count / c.sent_count) * 100).toFixed(1) + "%" : "—";
              return (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{meta.emoji} {meta.label}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{c.total_leads.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{c.sent_count.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{c.reply_count.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">{rate}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[c.status] ?? STATUS_BADGE.draft}`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-border bg-muted/20">
        <Link href="/super-dm-setter" className="text-xs text-brand-500 hover:text-brand-400 transition-colors">
          Launch new social campaign →
        </Link>
      </div>
    </div>
  );
}
