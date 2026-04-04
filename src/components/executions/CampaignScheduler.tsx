"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Clock, Play, Calendar, Zap, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Loader2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { describeSchedule } from "@/lib/schedule-utils";

type Frequency = "manual" | "daily" | "weekly" | "monthly";

type Schedule = {
  id: string;
  frequency: Frequency;
  day_of_week: number | null;
  day_of_month: number | null;
  hour_utc: number;
  timezone: string;
  pipeline_config: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PUSH_OPTIONS = [
  { id: "instantly", label: "Instantly.ai" },
  { id: "heyreach", label: "Heyreach" },
  { id: "smartlead", label: "Smartlead" },
  { id: "lemlist", label: "Lemlist" },
  { id: "hubspot", label: "HubSpot CRM" },
  { id: "n8n", label: "n8n" },
  { id: "make", label: "Make" },
  { id: "zapier", label: "Zapier" },
  { id: "clay", label: "Clay" },
  { id: "http", label: "Custom HTTP API" },
];

const WEBHOOK_IDS = ["n8n", "make", "zapier", "clay", "http"];

export function CampaignScheduler({ projectId }: { projectId: string }) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Form state
  const [frequency, setFrequency] = useState<Frequency>("manual");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hourUtc, setHourUtc] = useState(9);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [webhookUrls, setWebhookUrls] = useState<Record<string, string>>({});
  const [savedListId, setSavedListId] = useState("");

  useEffect(() => {
    fetch(`/api/schedules?projectId=${projectId}`)
      .then((r) => r.json())
      .then((j) => {
        const s = j.schedules?.[0] ?? null;
        setSchedule(s);
        if (s) {
          setFrequency(s.frequency);
          setDayOfWeek(s.day_of_week ?? 1);
          setDayOfMonth(s.day_of_month ?? 1);
          setHourUtc(s.hour_utc);
          const cfg = s.pipeline_config ?? {};
          setDestinations((cfg.step5_destinations as string[]) ?? []);
          setWebhookUrls((cfg.webhook_urls as Record<string, string>) ?? {});
          setSavedListId((cfg.step1_list_id as string) ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        frequency,
        dayOfWeek: frequency === "weekly" ? dayOfWeek : null,
        dayOfMonth: frequency === "monthly" ? dayOfMonth : null,
        hourUtc,
        pipelineConfig: {
          step1_source: savedListId ? "saved_list" : null,
          step1_list_id: savedListId || null,
          step5_destinations: destinations,
          webhook_urls: webhookUrls,
        },
        enabled: true,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setSchedule(json.schedule);
      setExpanded(false);
    }
    setSaving(false);
  };

  const handleToggle = async () => {
    if (!schedule) return;
    const res = await fetch(`/api/schedules/${schedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !schedule.enabled }),
    });
    const json = await res.json();
    if (res.ok) setSchedule(json.schedule);
  };

  const toggleDest = (id: string) => {
    setDestinations((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const description = describeSchedule({
    frequency,
    dayOfWeek,
    dayOfMonth,
    hourUtc,
    timezone: "UTC",
  });

  if (loading) return null;

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-card hover:bg-muted/30 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
          <Clock className="h-4 w-4 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">Campaign Schedule</span>
            {schedule ? (
              <Badge className={cn(
                "text-[10px] font-semibold",
                schedule.enabled
                  ? "bg-green-100 text-green-700 border-0"
                  : "bg-muted text-muted-foreground"
              )}>
                {schedule.enabled ? "Active" : "Paused"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Not configured</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {schedule
              ? describeSchedule({
                  frequency: schedule.frequency,
                  dayOfWeek: schedule.day_of_week,
                  dayOfMonth: schedule.day_of_month,
                  hourUtc: schedule.hour_utc,
                  timezone: schedule.timezone,
                })
              : "Set a schedule to run this campaign automatically — set and forget."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {schedule && (
            <button
              onClick={(e) => { e.stopPropagation(); handleToggle(); }}
              className="p-1 rounded-lg hover:bg-muted transition-colors"
              title={schedule.enabled ? "Pause schedule" : "Resume schedule"}
            >
              {schedule.enabled
                ? <ToggleRight className="h-5 w-5 text-green-600" />
                : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
            </button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Config panel */}
      {expanded && (
        <div className="border-t bg-muted/20 px-5 py-5 space-y-5">

          {/* Last / next run */}
          {schedule && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              {schedule.last_run_at && (
                <span>Last run: <strong className="text-foreground">{new Date(schedule.last_run_at).toLocaleString()}</strong></span>
              )}
              {schedule.next_run_at && schedule.enabled && (
                <span>Next run: <strong className="text-foreground">{new Date(schedule.next_run_at).toLocaleString()} UTC</strong></span>
              )}
            </div>
          )}

          {/* Frequency */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Run frequency</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["manual", "daily", "weekly", "monthly"] as Frequency[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={cn(
                    "px-3 py-2 rounded-lg border text-xs font-medium transition-colors capitalize",
                    frequency === f
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-border bg-card hover:border-brand-300"
                  )}
                >
                  {f === "manual" ? "Manual only" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {frequency === "manual" && (
              <p className="text-xs text-muted-foreground">You control when it runs. Click "Run Now" in the campaign to execute manually.</p>
            )}
          </div>

          {/* Day/time pickers */}
          {frequency !== "manual" && (
            <div className="flex gap-3 flex-wrap items-end">
              {frequency === "weekly" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Day of week</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="h-9 px-2 text-sm rounded-lg border border-border bg-background"
                  >
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
              )}
              {frequency === "monthly" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Day of month</label>
                  <select
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    className="h-9 px-2 text-sm rounded-lg border border-border bg-background"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium">Time (UTC)</label>
                <select
                  value={hourUtc}
                  onChange={(e) => setHourUtc(Number(e.target.value))}
                  className="h-9 px-2 text-sm rounded-lg border border-border bg-background"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{h.toString().padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-muted-foreground pb-2">→ {description}</div>
            </div>
          )}

          {/* Lead source for scheduled run */}
          {frequency !== "manual" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Lead source for automated runs</p>
              <p className="text-xs text-muted-foreground">
                Scheduled runs use a <a href="/lists" className="underline text-brand-600">Saved List</a> as the lead source (paste the list ID below). Create a list from any import in Step 1.
              </p>
              <Input
                className="text-sm h-9 max-w-sm"
                placeholder="Saved List ID (find in /lists)"
                value={savedListId}
                onChange={(e) => setSavedListId(e.target.value)}
              />
            </div>
          )}

          {/* Push destinations for automated runs */}
          {frequency !== "manual" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">Auto-push destinations</p>
              <div className="grid grid-cols-2 gap-2">
                {PUSH_OPTIONS.map((opt) => (
                  <div key={opt.id} className="space-y-1">
                    <button
                      onClick={() => toggleDest(opt.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium text-left transition-colors",
                        destinations.includes(opt.id)
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-border bg-card hover:border-brand-300"
                      )}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0",
                        destinations.includes(opt.id) ? "border-brand-500 bg-brand-500" : "border-muted-foreground"
                      )}>
                        {destinations.includes(opt.id) && (
                          <svg className="w-2 h-2 text-white" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      {opt.label}
                    </button>
                    {WEBHOOK_IDS.includes(opt.id) && destinations.includes(opt.id) && (
                      <Input
                        className="text-xs h-7"
                        placeholder="Webhook URL"
                        value={webhookUrls[opt.id] ?? ""}
                        onChange={(e) => setWebhookUrls((prev) => ({ ...prev, [opt.id]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="gradient"
              className="h-9"
              onClick={handleSave}
              loading={saving}
              disabled={saving}
            >
              {schedule ? "Update Schedule" : "Save Schedule"}
            </Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
