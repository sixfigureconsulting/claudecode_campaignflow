"use client";

import { useState, useCallback } from "react";

type ToastVariant = "default" | "destructive" | "success";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

let toastCallbacks: Array<(toast: Toast) => void> = [];

export function subscribeToToast(callback: (toast: Toast) => void) {
  toastCallbacks.push(callback);
  return () => {
    toastCallbacks = toastCallbacks.filter((cb) => cb !== callback);
  };
}

export function toast(params: Omit<Toast, "id">) {
  const id = Math.random().toString(36).slice(2);
  const newToast = { ...params, id };
  toastCallbacks.forEach((cb) => cb(newToast));
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((newToast: Toast) => {
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismiss };
}
