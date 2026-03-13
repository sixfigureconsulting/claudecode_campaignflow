"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, X, AlertTriangle } from "lucide-react";

export type ToastVariant = "default" | "success" | "destructive" | "warning";

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

// Global toast event bus
const listeners: Array<(toast: ToastData) => void> = [];

export function toast(params: Omit<ToastData, "id">) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newToast: ToastData = { ...params, id };
  listeners.forEach((fn) => fn(newToast));
}

export function subscribeToast(fn: (toast: ToastData) => void) {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

const ICON: Record<ToastVariant, React.ReactNode> = {
  default: null,
  success: <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />,
  destructive: <XCircle className="h-4 w-4 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />,
};

const BG: Record<ToastVariant, string> = {
  default: "bg-background border-border",
  success: "bg-green-50 border-green-200",
  destructive: "bg-red-50 border-red-200",
  warning: "bg-yellow-50 border-yellow-200",
};

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  const variant = t.variant ?? "default";
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-72 max-w-sm",
        "animate-fade-in",
        BG[variant]
      )}
    >
      {ICON[variant]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{t.title}</p>
        {t.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(t.id)}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const unsub = subscribeToast((t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4500);
    });
    return unsub;
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
