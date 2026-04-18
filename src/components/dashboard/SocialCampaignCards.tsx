import Link from "next/link";
import { MessageCircle, Send, Reply, ArrowRight } from "lucide-react";

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

const CHANNEL_META: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
  linkedin:  { emoji: "💼", color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
  reddit:    { emoji: "🔴", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  twitter:   { emoji: "🐦", color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/20" },
  instagram: { emoji: "📸", color: "text-pink-400",   bg: "bg-pink-500/10",   border: "border-pink-500/20" },
  facebook:  { emoji: "👥", color: "text-blue-300",   bg: "bg-blue-400/10",   border: "border-blue-400/20" },
  email:     { emoji: "✉️", color: "text-emerald-400",bg: "bg-emerald-500/10",border: "border-emerald-500/20" },
};

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  draft:     "bg-gray-500/15 text-gray-400 border-gray-500/25",
  paused:    "bg-amber-500/15 text-amber-400 border-amber-500/25",
  completed: "bg-brand-500/15 text-brand-400 border-brand-500/25",
  failed:    "bg-red-500/15 text-red-400 border-red-500/25",
};

export function SocialCampaignCards({ campaigns }: { campaigns: SocialCampaign[] }) {
  if (campaigns.length === 0) return null;

  const totalSent   = campaigns.reduce((s, c) => s + c.sent_count, 0);
  const totalReplies = campaigns.reduce((s, c) => s + c.reply_count, 0);
  const replyRate   = totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Social DM Campaigns
        </h2>
        <Link href="/super-dm-setter" className="text-xs text-brand-500 hover:text-brand-400 flex items-center gap-1 transition-colors">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total sent",   value: totalSent.toLocaleString(),    icon: Send },
          { label: "Replies",      value: totalReplies.toLocaleString(), icon: Reply },
          { label: "Reply rate",   value: `${replyRate}%`,               icon: MessageCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-muted/50 border border-border rounded-xl p-3">
            <Icon className="h-3.5 w-3.5 text-muted-foreground mb-1.5" />
            <p className="text-lg font-bold tabular-nums">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Campaign rows */}
      <div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
        {campaigns.map((c) => {
          const meta = CHANNEL_META[c.channel] ?? CHANNEL_META.email;
          const rate = c.sent_count > 0 ? ((c.reply_count / c.sent_count) * 100).toFixed(0) : "—";
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 border ${meta.bg} ${meta.border}`}>
                {meta.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className={`text-xs ${meta.color}`}>{c.channel}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-right shrink-0">
                <div>
                  <p className="font-semibold tabular-nums">{c.sent_count.toLocaleString()}</p>
                  <p className="text-muted-foreground">sent</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums">{c.reply_count.toLocaleString()}</p>
                  <p className="text-muted-foreground">replies</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums">{rate}%</p>
                  <p className="text-muted-foreground">rate</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_BADGE[c.status] ?? STATUS_BADGE.draft}`}>
                  {c.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
