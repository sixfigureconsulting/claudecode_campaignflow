import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { History, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import type { Execution } from "@/types/database";

const STATUS_META = {
  completed: { label: "Completed", icon: CheckCircle2, className: "text-green-600" },
  failed: { label: "Failed", icon: XCircle, className: "text-red-500" },
  running: { label: "Running", icon: Loader2, className: "text-blue-500 animate-spin" },
  pending: { label: "Pending", icon: Clock, className: "text-muted-foreground" },
};

const ACTION_LABELS: Record<string, string> = {
  apollo_enrich: "Apollo Enrich",
  sfc_sequence_builder: "SFC Sequences",
};

export function ExecutionHistory({ executions }: { executions: Execution[] }) {
  if (!executions.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No executions yet. Run an action above to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Execution History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {executions.map((exec) => {
            const meta = STATUS_META[exec.status] ?? STATUS_META.pending;
            const Icon = meta.icon;
            return (
              <div key={exec.id} className="flex items-start gap-3 px-4 py-3">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.className}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {ACTION_LABELS[exec.action_type] ?? exec.action_type}
                    </span>
                    <Badge
                      variant={exec.status === "completed" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {meta.label}
                    </Badge>
                  </div>
                  {exec.inputs_summary && (
                    <p className="text-xs text-muted-foreground mt-0.5">{exec.inputs_summary}</p>
                  )}
                  {exec.outputs_summary && (
                    <p className="text-xs text-muted-foreground">{exec.outputs_summary}</p>
                  )}
                  {exec.error_message && (
                    <p className="text-xs text-red-500 mt-0.5">{exec.error_message}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                  {new Date(exec.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
