export type ScheduleConfig = {
  frequency: "manual" | "daily" | "weekly" | "monthly";
  dayOfWeek?: number | null;   // 0=Sun..6=Sat
  dayOfMonth?: number | null;  // 1-28
  hourUtc: number;
  timezone: string;
};

/** Compute the next UTC timestamp this schedule should fire. */
export function computeNextRun(cfg: ScheduleConfig): string | null {
  if (cfg.frequency === "manual") return null;

  const now = new Date();
  const next = new Date(now);

  if (cfg.frequency === "daily") {
    next.setUTCHours(cfg.hourUtc, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  } else if (cfg.frequency === "weekly") {
    const targetDay = cfg.dayOfWeek ?? 1; // default Monday
    next.setUTCHours(cfg.hourUtc, 0, 0, 0);
    const diff = (targetDay - next.getUTCDay() + 7) % 7;
    next.setUTCDate(next.getUTCDate() + (diff === 0 && next <= now ? 7 : diff));
  } else if (cfg.frequency === "monthly") {
    const targetDate = cfg.dayOfMonth ?? 1;
    next.setUTCDate(targetDate);
    next.setUTCHours(cfg.hourUtc, 0, 0, 0);
    if (next <= now) {
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(targetDate);
    }
  }

  return next.toISOString();
}

export function describeSchedule(cfg: ScheduleConfig): string {
  if (cfg.frequency === "manual") return "Manual — run when you choose";
  const hour = cfg.hourUtc.toString().padStart(2, "0") + ":00 UTC";
  if (cfg.frequency === "daily") return `Daily at ${hour}`;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (cfg.frequency === "weekly") return `Every ${days[cfg.dayOfWeek ?? 1]} at ${hour}`;
  if (cfg.frequency === "monthly") return `Monthly on the ${ordinal(cfg.dayOfMonth ?? 1)} at ${hour}`;
  return cfg.frequency;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
