"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { reportSchema, type ReportFormData } from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

export function AddReportDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      report_type: "monthly",
      report_date: today,
    },
  });

  const onSubmit = async (data: ReportFormData) => {
    setError(null);
    const supabase = createClient();

    const { error: insertError } = await supabase.from("reports").insert({
      project_id: projectId,
      name: data.name,
      report_type: data.report_type,
      report_date: data.report_date,
      notes: data.notes || null,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient" size="sm">
          <Plus className="h-4 w-4" />
          Add Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Report</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Report Name *</Label>
            <Input
              placeholder="March 2025 Performance Report"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Report Type *</Label>
              <Select
                defaultValue="monthly"
                onValueChange={(v) => setValue("report_type", v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Report Date *</Label>
              <Input
                type="date"
                error={errors.report_date?.message}
                {...register("report_date")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any context for this reporting period..."
              className="h-16"
              {...register("notes")}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="gradient" loading={isSubmitting}>
              Create Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
